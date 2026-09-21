from pathlib import Path


def project_dir(data_dir: str | Path, project_id: str) -> Path:
    root = Path(data_dir).resolve() / "projects"
    abs_ = (root / project_id).resolve()
    if abs_ != root and not str(abs_).startswith(str(root) + "/"):
        if not str(abs_).startswith(str(root) + "\\"):
            raise ValueError("traversal")
    return abs_


def job_dir(data_dir: str | Path, project_id: str, module: str, job_id: str) -> Path:
    return project_dir(data_dir, project_id) / module / job_id
