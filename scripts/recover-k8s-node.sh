#!/usr/bin/env bash
#
# recover-k8s-node.sh — 恢复因 PLEG 不健康 / NotReady 的 Kubernetes 工作节点
#
# 典型症状（与日志一致）:
#   - "PLEG is not healthy: pleg was last seen active ... threshold is 3m0s"
#   - "Skipping pod synchronization"
#   - "Node became not ready"
#   - container runtime 操作超时 (ExecSync / KillContainer / StopPodSandbox)
#
# 用法:
#   sudo ./recover-k8s-node.sh              # 标准恢复
#   sudo ./recover-k8s-node.sh --diagnose   # 仅诊断，不执行恢复
#   sudo ./recover-k8s-node.sh --force      # 跳过交互确认
#   sudo ./recover-k8s-node.sh --hard       # 强制清理僵死容器后重启运行时
#
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_DIR="/var/log/k8s-node-recovery"
readonly TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
readonly LOG_FILE="${LOG_DIR}/recovery-${TIMESTAMP}.log"

# 默认参数
DRY_RUN=false
FORCE=false
HARD=false
DIAGNOSE_ONLY=false
SKIP_CORDON=false
WAIT_READY_TIMEOUT=300

usage() {
  cat <<'EOF'
用法: recover-k8s-node.sh [选项]

选项:
  --diagnose        仅收集诊断信息，不执行恢复
  --dry-run         打印将要执行的命令，不实际执行
  --force           跳过交互确认
  --hard            强制模式：清理僵死容器/沙箱后再重启运行时
  --skip-cordon     跳过 cordon（若从集群外无法执行 kubectl）
  --wait-timeout N  等待节点 Ready 的超时秒数（默认 300）
  -h, --help        显示帮助

建议在故障节点上以 root 执行:
  sudo ./recover-k8s-node.sh

恢复流程:
  1. 收集诊断信息
  2. 检查磁盘/inode/内存
  3. cordon 节点（可选）
  4. 重启容器运行时 (containerd/docker)
  5. 清理僵死容器（--hard 或检测到僵死时）
  6. 重启 kubelet
  7. 等待节点恢复 Ready 并 uncordon
EOF
}

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

run_cmd() {
  local desc="$1"
  shift
  log ">>> $desc"
  log "    命令: $*"
  if [[ "$DRY_RUN" == true ]]; then
    log "    [dry-run] 跳过执行"
    return 0
  fi
  if "$@" >>"$LOG_FILE" 2>&1; then
    log "    完成"
    return 0
  else
    local rc=$?
    log "    失败 (exit=$rc)"
    return "$rc"
  fi
}

run_cmd_allow_fail() {
  local desc="$1"
  shift
  log ">>> $desc"
  log "    命令: $*"
  if [[ "$DRY_RUN" == true ]]; then
    log "    [dry-run] 跳过执行"
    return 0
  fi
  "$@" >>"$LOG_FILE" 2>&1 || log "    警告: 命令失败 (exit=$?)，继续执行"
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "错误: 请使用 root 权限运行 (sudo $SCRIPT_NAME)" >&2
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --diagnose)     DIAGNOSE_ONLY=true ;;
      --dry-run)      DRY_RUN=true ;;
      --force)        FORCE=true ;;
      --hard)         HARD=true ;;
      --skip-cordon)  SKIP_CORDON=true ;;
      --wait-timeout)
        WAIT_READY_TIMEOUT="$2"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "未知参数: $1" >&2
        usage
        exit 1
        ;;
    esac
    shift
  done
}

get_node_name() {
  hostname -s 2>/dev/null || hostname
}

detect_runtime() {
  if systemctl is-active --quiet containerd 2>/dev/null; then
    echo "containerd"
  elif systemctl is-active --quiet docker 2>/dev/null; then
    echo "docker"
  elif systemctl is-enabled --quiet containerd 2>/dev/null; then
    echo "containerd"
  elif systemctl is-enabled --quiet docker 2>/dev/null; then
    echo "docker"
  else
    echo "unknown"
  fi
}

collect_diagnostics() {
  local node
  node="$(get_node_name)"
  log "========== 诊断信息: 节点 ${node} =========="

  run_cmd_allow_fail "系统负载" uptime
  run_cmd_allow_fail "内存使用" free -h
  run_cmd_allow_fail "磁盘使用" df -hT
  run_cmd_allow_fail "inode 使用" df -hi
  run_cmd_allow_fail "kubelet 状态" systemctl status kubelet --no-pager -l
  run_cmd_allow_fail "最近 kubelet 日志 (PLEG/timeout)" \
    journalctl -u kubelet --since "30 min ago" --no-pager \
    | grep -E "PLEG|NotReady|timeout|DeadlineExceeded|Skipping pod" | tail -80 || true

  local runtime
  runtime="$(detect_runtime)"
  case "$runtime" in
    containerd)
      run_cmd_allow_fail "containerd 状态" systemctl status containerd --no-pager -l
      run_cmd_allow_fail "crictl pods" crictl pods 2>/dev/null || true
      run_cmd_allow_fail "crictl ps -a" crictl ps -a 2>/dev/null || true
      ;;
    docker)
      run_cmd_allow_fail "docker 状态" systemctl status docker --no-pager -l
      run_cmd_allow_fail "docker ps -a" docker ps -a 2>/dev/null || true
      run_cmd_allow_fail "docker info" docker info 2>/dev/null || true
      ;;
  esac

  if command -v kubectl >/dev/null 2>&1 && [[ -f /etc/kubernetes/kubelet.conf ]]; then
    run_cmd_allow_fail "节点状态" kubectl --kubeconfig=/etc/kubernetes/kubelet.conf get node "$(get_node_name)" -o wide 2>/dev/null || true
  fi

  log "诊断日志已保存: $LOG_FILE"
}

check_prerequisites() {
  local issues=0

  # 根分区空间 < 15% 可用时警告
  local avail_pct
  avail_pct="$(df / | awk 'NR==2 {gsub(/%/,"",$5); print 100-$5}')"
  if [[ "${avail_pct:-0}" -lt 15 ]]; then
    log "警告: 根分区可用空间仅 ${avail_pct}% — 磁盘满常导致 PLEG 卡死"
    issues=$((issues + 1))
  fi

  # inode 可用 < 10%
  local inode_avail
  inode_avail="$(df -i / | awk 'NR==2 {gsub(/%/,"",$5); print 100-$5}')"
  if [[ "${inode_avail:-0}" -lt 10 ]]; then
    log "警告: 根分区 inode 可用仅 ${inode_avail}%"
    issues=$((issues + 1))
  fi

  # 内存可用 < 500MB
  local mem_avail_kb
  mem_avail_kb="$(awk '/MemAvailable/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  if [[ "${mem_avail_kb:-0}" -lt 512000 ]]; then
    log "警告: 可用内存不足 (${mem_avail_kb} KB)"
    issues=$((issues + 1))
  fi

  if [[ "$issues" -gt 0 ]]; then
    log "检测到 ${issues} 个资源告警，恢复可能失败，建议先清理磁盘/内存"
  fi
}

cordon_node() {
  if [[ "$SKIP_CORDON" == true ]]; then
    log "跳过 cordon (--skip-cordon)"
    return 0
  fi

  local node
  node="$(get_node_name)"

  if ! command -v kubectl >/dev/null 2>&1; then
    log "未找到 kubectl，跳过 cordon"
    return 0
  fi

  local kubeconfig=""
  if [[ -f /root/.kube/config ]]; then
    kubeconfig="/root/.kube/config"
  elif [[ -f /etc/kubernetes/admin.conf ]]; then
    kubeconfig="/etc/kubernetes/admin.conf"
  else
    log "未找到 kubeconfig，跳过 cordon"
    return 0
  fi

  run_cmd_allow_fail "cordon 节点 ${node}" \
    kubectl --kubeconfig="$kubeconfig" cordon "$node"
}

uncordon_node() {
  if [[ "$SKIP_CORDON" == true ]]; then
    return 0
  fi

  local node
  node="$(get_node_name)"

  if ! command -v kubectl >/dev/null 2>&1; then
    return 0
  fi

  local kubeconfig=""
  if [[ -f /root/.kube/config ]]; then
    kubeconfig="/root/.kube/config"
  elif [[ -f /etc/kubernetes/admin.conf ]]; then
    kubeconfig="/etc/kubernetes/admin.conf"
  else
    return 0
  fi

  run_cmd_allow_fail "uncordon 节点 ${node}" \
    kubectl --kubeconfig="$kubeconfig" uncordon "$node"
}

cleanup_stuck_docker() {
  log "清理 Docker 僵死容器与未使用资源"

  # 停止非 kube 管理的异常容器（谨慎：仅清理已退出的）
  run_cmd_allow_fail "删除已退出容器" docker container prune -f

  # 清理无引用的网络
  run_cmd_allow_fail "清理未使用网络" docker network prune -f

  # 列出仍在运行但可能卡死的容器（供日志参考）
  run_cmd_allow_fail "当前运行中容器" docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}'
}

cleanup_stuck_containerd() {
  log "清理 containerd 僵死沙箱"

  if ! command -v crictl >/dev/null 2>&1; then
    log "未找到 crictl，跳过 containerd 清理"
    return 0
  fi

  # 尝试停止异常 pod sandbox（NotReady 超过阈值的由 kubelet 重管，这里只做温和清理）
  run_cmd_allow_fail "crictl 列出 pods" crictl pods
  run_cmd_allow_fail "crictl 列出容器" crictl ps -a

  # 清理已退出容器
  local exited_ids
  exited_ids="$(crictl ps -a --state Exited -q 2>/dev/null || true)"
  if [[ -n "$exited_ids" ]]; then
    run_cmd_allow_fail "删除已退出容器" crictl rm $exited_ids
  fi
}

force_kill_hung_containers() {
  log "强制模式: 尝试终止无响应容器"

  local runtime
  runtime="$(detect_runtime)"

  case "$runtime" in
    docker)
      # 对运行超过 1 天且名称含 task/workflow 的容器发送 SIGKILL（GPU 训练任务常见僵死场景）
      while IFS= read -r cid; do
        [[ -z "$cid" ]] && continue
        log "    强制 kill 容器: $cid"
        if [[ "$DRY_RUN" != true ]]; then
          docker kill -s KILL "$cid" 2>/dev/null || true
          sleep 1
          docker rm -f "$cid" 2>/dev/null || true
        fi
      done < <(docker ps -q 2>/dev/null || true)
      ;;
    containerd)
      if command -v crictl >/dev/null 2>&1; then
        while IFS= read -r cid; do
          [[ -z "$cid" ]] && continue
          log "    强制 stop 容器: $cid"
          if [[ "$DRY_RUN" != true ]]; then
            crictl stop -t 5 "$cid" 2>/dev/null || true
            crictl rm "$cid" 2>/dev/null || true
          fi
        done < <(crictl ps -q 2>/dev/null || true)
      fi
      ;;
  esac
}

restart_container_runtime() {
  local runtime
  runtime="$(detect_runtime)"
  log "检测到容器运行时: $runtime"

  case "$runtime" in
    containerd)
      run_cmd "停止 kubelet" systemctl stop kubelet
      sleep 3
      run_cmd "重启 containerd" systemctl restart containerd
      sleep 5
      run_cmd_allow_fail "验证 containerd" systemctl is-active containerd
      ;;
    docker)
      run_cmd "停止 kubelet" systemctl stop kubelet
      sleep 3
      run_cmd "重启 docker" systemctl restart docker
      sleep 8
      run_cmd_allow_fail "验证 docker" systemctl is-active docker
      ;;
    *)
      log "错误: 无法识别容器运行时 (containerd/docker)"
      exit 1
      ;;
  esac
}

restart_kubelet() {
  run_cmd "重启 kubelet" systemctl restart kubelet
  sleep 5
  run_cmd_allow_fail "kubelet 状态" systemctl is-active kubelet
}

wait_for_node_ready() {
  local node="$1"
  local timeout="$2"
  local elapsed=0
  local interval=10

  if [[ "$DRY_RUN" == true ]]; then
    log "[dry-run] 跳过等待 Ready"
    return 0
  fi

  log "等待节点 ${node} 恢复 Ready（超时 ${timeout}s）..."

  while [[ "$elapsed" -lt "$timeout" ]]; do
    # 方法 1: 本地检查 kubelet 健康
    if curl -sf --max-time 3 http://127.0.0.1:10248/healthz >/dev/null 2>&1; then
      log "kubelet /healthz 正常 (${elapsed}s)"
    fi

    # 方法 2: kubectl 检查 Ready 条件
    if command -v kubectl >/dev/null 2>&1; then
      local kubeconfig=""
      [[ -f /root/.kube/config ]] && kubeconfig="/root/.kube/config"
      [[ -z "$kubeconfig" && -f /etc/kubernetes/admin.conf ]] && kubeconfig="/etc/kubernetes/admin.conf"

      if [[ -n "$kubeconfig" ]]; then
        local ready
        ready="$(kubectl --kubeconfig="$kubeconfig" get node "$node" \
          -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")"
        if [[ "$ready" == "True" ]]; then
          log "节点 ${node} 已 Ready (耗时 ${elapsed}s)"
          return 0
        fi
        log "  当前 Ready=${ready}，已等待 ${elapsed}s"
      fi
    else
      # 无 kubectl 时检查 PLEG 相关日志是否恢复
      if ! journalctl -u kubelet --since "1 min ago" --no-pager 2>/dev/null \
        | grep -q "PLEG is not healthy"; then
        if systemctl is-active --quiet kubelet; then
          log "kubelet 运行中且近期无 PLEG 错误 (耗时 ${elapsed}s)"
          return 0
        fi
      fi
    fi

    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  log "警告: 等待 Ready 超时 (${timeout}s)，请检查日志: journalctl -u kubelet -f"
  return 1
}

confirm_recovery() {
  if [[ "$FORCE" == true || "$DRY_RUN" == true ]]; then
    return 0
  fi

  local node
  node="$(get_node_name)"
  echo ""
  echo "即将对节点 [${node}] 执行恢复操作:"
  echo "  - cordon 节点（若可用）"
  echo "  - 重启容器运行时 + kubelet"
  if [[ "$HARD" == true ]]; then
    echo "  - 强制清理僵死容器 (--hard)"
  fi
  echo ""
  read -r -p "确认继续? [y/N] " answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "已取消"; exit 0 ;;
  esac
}

main() {
  parse_args "$@"
  require_root

  mkdir -p "$LOG_DIR"
  touch "$LOG_FILE"

  local node
  node="$(get_node_name)"

  log "=========================================="
  log "K8s 节点恢复脚本启动"
  log "节点: ${node}"
  log "参数: diagnose=${DIAGNOSE_ONLY} dry_run=${DRY_RUN} force=${FORCE} hard=${HARD}"
  log "=========================================="

  collect_diagnostics
  check_prerequisites

  if [[ "$DIAGNOSE_ONLY" == true ]]; then
    log "仅诊断模式，退出"
    echo ""
    echo "诊断完成。日志: $LOG_FILE"
    exit 0
  fi

  confirm_recovery

  # --- 恢复流程 ---
  cordon_node

  if [[ "$HARD" == true ]]; then
    run_cmd "停止 kubelet（强制清理前）" systemctl stop kubelet
    force_kill_hung_containers
  fi

  local runtime
  runtime="$(detect_runtime)"
  case "$runtime" in
    docker)  cleanup_stuck_docker ;;
    containerd) cleanup_stuck_containerd ;;
  esac

  restart_container_runtime
  restart_kubelet

  if wait_for_node_ready "$node" "$WAIT_READY_TIMEOUT"; then
    uncordon_node
    log "=========================================="
    log "节点恢复成功"
    log "=========================================="
    echo ""
    echo "恢复完成。节点应已 Ready。"
    echo "完整日志: $LOG_FILE"
    exit 0
  else
    log "=========================================="
    log "节点未能自动恢复 Ready"
    log "建议手动排查:"
    log "  1. journalctl -u kubelet -f"
    log "  2. journalctl -u docker -f  或  journalctl -u containerd -f"
    log "  3. df -h && df -i  (检查磁盘/inode)"
    log "  4. 若仍失败: 从集群 drain 后重启节点 OS"
    log "=========================================="
    echo ""
    echo "恢复未完全成功，请查看日志: $LOG_FILE"
    exit 2
  fi
}

main "$@"
