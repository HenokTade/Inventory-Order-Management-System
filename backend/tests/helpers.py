"""Test helpers shared across test modules."""

from contextlib import contextmanager

from django.db import DEFAULT_DB_ALIAS, connections


@contextmanager
def capture_on_commit_callbacks(using: str = DEFAULT_DB_ALIAS, execute: bool = True):
    """Replicates Django TestCase.captureOnCommitCallbacks for pytest."""
    callbacks: list = []
    start_count = len(connections[using].run_on_commit)
    try:
        yield callbacks
    finally:
        while True:
            callback_count = len(connections[using].run_on_commit)
            for _sid, callback, robust in connections[using].run_on_commit[start_count:]:
                callbacks.append(callback)
                if execute:
                    if robust:
                        try:
                            callback()
                        except Exception:  # noqa: BLE001 - mirrors Django's robust handling
                            pass
                    else:
                        callback()
            if callback_count == len(connections[using].run_on_commit):
                break
            start_count = callback_count
