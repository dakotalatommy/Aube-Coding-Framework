from src.backend.app.main import app


def test_routes_are_unique_by_path_and_method():
    seen = set()
    dups = []
    for r in getattr(app.router, "routes", []):
        path = getattr(r, "path", None)
        methods = set(getattr(r, "methods", set()) or set())
        methods.discard("HEAD")
        key = (path, tuple(sorted(methods)))
        if key in seen:
            dups.append(key)
        else:
            seen.add(key)
    assert not dups, f"Duplicate routes detected: {dups}"

