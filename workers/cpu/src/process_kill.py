import os
import subprocess
from typing import Optional, Sequence

CREATE_NEW_PROCESS_GROUP = 0x00000200


def spawn(
    argv: Sequence[str],
    *,
    timeout_sec: int,
    stdin_bytes: Optional[bytes] = None,
) -> subprocess.CompletedProcess:
    kwargs = dict(
        args=list(argv),
        stdin=subprocess.PIPE if stdin_bytes is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    p = subprocess.Popen(**kwargs)
    try:
        out, err = p.communicate(input=stdin_bytes, timeout=timeout_sec)
        return subprocess.CompletedProcess(p.args, p.returncode, out, err)
    except subprocess.TimeoutExpired:
        kill_tree(p.pid)
        p.wait(timeout=10)
        raise


def kill_tree(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            check=False,
            timeout=10,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        import signal

        os.killpg(pid, signal.SIGKILL)
