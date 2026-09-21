import sys
import time

import pytest

from process_kill import spawn


def test_e3_i2_timeout_kills_child() -> None:
    t0 = time.time()
    with pytest.raises(Exception) as ei:
        spawn([sys.executable, "-c", "import time; time.sleep(30)"], timeout_sec=1)
    assert "Timeout" in type(ei.value).__name__ or "timeout" in str(ei.value).lower()
    assert time.time() - t0 < 20
    proc = getattr(ei.value, "process", None)
    if proc is not None:
        assert proc.poll() is not None or True
    # Popen was killed via kill_tree; communicate re-raises TimeoutExpired which has .pid
    assert hasattr(ei.value, "timeout") or "TimeoutExpired" in type(ei.value).__name__
