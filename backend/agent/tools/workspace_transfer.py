"""Transfer regular workspace files between dependent workers of one turn."""

from __future__ import annotations

import asyncio
import os
import shlex
import tempfile
import uuid

MAX_WORKSPACE_BYTES = 64 * 1024 * 1024


async def copy_workspace(source, destination) -> None:
    """Snapshot workspace files; never share live sessions between workers.

    Executables and packages are not shared across independent workers. A
    handoff reuses its existing session, so it preserves those too.
    """
    archive = f"/tmp/worker-workspace-{uuid.uuid4().hex}.tar"
    export = f"""
import os, tarfile
root = '/home/user'
total = 0
count = 0
with tarfile.open({archive!r}, 'w') as archive:
    for directory, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in ('.cache', '.local', '.venv') and not os.path.islink(os.path.join(directory, d)))
        for name in sorted(files):
            path = os.path.join(directory, name)
            if os.path.islink(path) or not os.path.isfile(path):
                continue
            total += os.path.getsize(path)
            count += 1
            if total > {MAX_WORKSPACE_BYTES} or count > 10_000:
                raise RuntimeError('Dependency workspace exceeds transfer limit')
            archive.add(path, arcname=os.path.relpath(path, root), recursive=False)
"""
    try:
        result = await source.exec(f"python3 -c {shlex.quote(export)}", timeout=60)
        if not result.success:
            raise RuntimeError("Dependency workspace snapshot failed")
        with tempfile.TemporaryDirectory(
            prefix="synapse-worker-transfer-"
        ) as directory:
            local_path = os.path.join(directory, "workspace.tar")
            await asyncio.wait_for(source.download_file(archive, local_path), 60)
            # tar headers/padding add a small fixed allowance to the payload cap.
            if os.path.getsize(local_path) > MAX_WORKSPACE_BYTES + 8 * 1024 * 1024:
                raise RuntimeError(
                    "Dependency workspace archive exceeds transfer limit"
                )
            await asyncio.wait_for(destination.upload_file(local_path, archive), 60)
        extract = f"""
import os, tarfile
with tarfile.open({archive!r}, 'r') as archive:
    members = archive.getmembers()
    if len(members) > 10_000:
        raise RuntimeError('Dependency archive has too many entries')
    if any(not (item.isfile() or item.isdir()) for item in members):
        raise RuntimeError('Dependency archive contains non-file entries')
    if sum(item.size for item in members) > {MAX_WORKSPACE_BYTES}:
        raise RuntimeError('Dependency archive exceeds transfer limit')
    # Refuse ambiguous merges from multiple producers instead of silently
    # overwriting another dependency's different file at the same path.
    for member in members:
        target = os.path.join('/home/user', member.name)
        if member.isfile() and os.path.isfile(target) and not os.path.islink(target):
            import hashlib
            with open(target, 'rb') as existing, archive.extractfile(member) as incoming:
                if hashlib.file_digest(existing, 'sha256').digest() != hashlib.file_digest(incoming, 'sha256').digest():
                    raise RuntimeError('Conflicting dependency workspace files')
    # data filter checks path traversal and existing symlinks at extraction time.
    archive.extractall('/home/user', members=members, filter='data')
"""
        result = await destination.exec(
            f"python3 -c {shlex.quote(extract)}", timeout=60
        )
        if not result.success:
            raise RuntimeError("Dependency workspace restore failed")
    finally:
        await asyncio.gather(
            source.exec(f"rm -f {shlex.quote(archive)}", timeout=5),
            destination.exec(f"rm -f {shlex.quote(archive)}", timeout=5),
            return_exceptions=True,
        )
