import argparse, hashlib, os, re, sys, urllib.parse, urllib.request, zipfile
from pathlib import Path

URL_RE = re.compile(r'''(?ix)
(?:src|href)\s*=\s*(?P<q>["'])(?P<u>.+?)(?P=q)
''')

CSS_URL_RE = re.compile(r'''(?ix)
url\(\s*(?P<q>["']?)(?P<u>.+?)(?P=q)\s*\)
''')

DATA_URL_RE = re.compile(r'(?i)^\s*data:')

def sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", "ignore")).hexdigest()

def safe_ext_from_url(u: str) -> str:
    path = urllib.parse.urlparse(u).path
    ext = Path(path).suffix
    if ext and len(ext) <= 8:
        return ext
    return ""

def is_http(u: str) -> bool:
    try:
        pu = urllib.parse.urlparse(u)
        return pu.scheme in ("http", "https")
    except Exception:
        return False

def normalize_asset_proxy(u: str) -> str:
    try:
        pu = urllib.parse.urlparse(u)
        if pu.path == "/asset":
            qs = urllib.parse.parse_qs(pu.query)
            raw = qs.get("url", [None])[0]
            if raw and is_http(raw):
                return raw
    except Exception:
        pass
    return u

def fetch(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def write_bytes(p: Path, b: bytes):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b)

def relpath_from(root: Path, p: Path) -> str:
    return str(p.relative_to(root)).replace("\\", "/")

def rewrite_html_and_collect(html: str, base_url: str, out_root: Path) -> tuple[str, dict[str, str]]:
    assets_dir = out_root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    mapping: dict[str, str] = {}
    seen: set[str] = set()

    def resolve(u: str) -> str:
        u = u.strip()
        u = normalize_asset_proxy(u)
        if not u:
            return u
        if u.startswith("//"):
            return "https:" + u
        if is_http(u):
            return u
        if base_url:
            return urllib.parse.urljoin(base_url, u)
        return u

    def download_to_local(abs_url: str) -> str:
        if abs_url in mapping:
            return mapping[abs_url]

        ext = safe_ext_from_url(abs_url)
        name = sha1(abs_url)[:16] + ext
        local = assets_dir / name

        try:
            data = fetch(abs_url)
            write_bytes(local, data)
        except Exception as e:
            return abs_url

        rel = "./" + relpath_from(out_root, local)
        mapping[abs_url] = rel
        return rel

    def sub_attr(m: re.Match) -> str:
        q = m.group("q")
        u = m.group("u")
        u2 = u.strip()
        if not u2 or DATA_URL_RE.match(u2):
            return m.group(0)
        abs_u = resolve(u2)
        if not is_http(abs_u):
            return m.group(0)
        local = download_to_local(abs_u)
        return f'{m.group(0).split("=")[0]}={q}{local}{q}'

    html2 = URL_RE.sub(sub_attr, html)

    def css_url_sub(m: re.Match) -> str:
        u = (m.group("u") or "").strip()
        if not u or DATA_URL_RE.match(u):
            return m.group(0)
        abs_u = resolve(u)
        if not is_http(abs_u):
            return m.group(0)
        local = download_to_local(abs_u)
        return f'url("{local}")'

    html2 = CSS_URL_RE.sub(css_url_sub, html2)

    return html2, mapping

def collect_linked_css(html: str) -> list[str]:
    links = []
    for m in re.finditer(r'(?is)<link[^>]+rel=["\']stylesheet["\'][^>]*>', html):
        tag = m.group(0)
        m2 = re.search(r'(?is)href\s*=\s*(["\'])(.+?)\1', tag)
        if m2:
            links.append(m2.group(2).strip())
    return links

def rewrite_css_and_collect(css_text: str, base_url: str, out_root: Path, mapping: dict[str, str]) -> str:
    assets_dir = out_root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    def resolve(u: str) -> str:
        u = u.strip()
        u = normalize_asset_proxy(u)
        if not u:
            return u
        if u.startswith("//"):
            return "https:" + u
        if is_http(u):
            return u
        if base_url:
            return urllib.parse.urljoin(base_url, u)
        return u

    def download_to_local(abs_url: str) -> str:
        if abs_url in mapping:
            return mapping[abs_url]
        ext = safe_ext_from_url(abs_url)
        name = sha1(abs_url)[:16] + ext
        local = assets_dir / name
        try:
            data = fetch(abs_url)
            write_bytes(local, data)
        except Exception:
            return abs_url
        rel = "./" + relpath_from(out_root, local)
        mapping[abs_url] = rel
        return rel

    def css_url_sub(m: re.Match) -> str:
        u = (m.group("u") or "").strip()
        if not u or DATA_URL_RE.match(u):
            return m.group(0)
        abs_u = resolve(u)
        if not is_http(abs_u):
            return m.group(0)
        local = download_to_local(abs_u)
        return f'url("{local}")'

    return CSS_URL_RE.sub(css_url_sub, css_text)

def zip_dir(src: Path, zip_path: Path):
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for p in src.rglob("*"):
            if p.is_file():
                z.write(p, relpath_from(src, p))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="Path to exported HTML file")
    ap.add_argument("--base", dest="base", default="", help="Base URL used to resolve relative assets (optional)")
    ap.add_argument("--out", dest="out", required=True, help="Output folder to write rewritten site")
    ap.add_argument("--zip", dest="zipf", default="", help="If set, also create zip at this path")
    args = ap.parse_args()

    inp = Path(args.inp).expanduser().resolve()
    out = Path(args.out).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)

    html = inp.read_text(encoding="utf-8", errors="ignore")
    html2, mapping = rewrite_html_and_collect(html, args.base, out)

    css_links = collect_linked_css(html)
    css_dir = out / "css"
    css_dir.mkdir(parents=True, exist_ok=True)

    for href in css_links:
        href2 = normalize_asset_proxy(href)
        abs_u = href2
        if href2.startswith("//"):
            abs_u = "https:" + href2
        elif not is_http(href2) and args.base:
            abs_u = urllib.parse.urljoin(args.base, href2)

        if not is_http(abs_u):
            continue

        try:
            css_bytes = fetch(abs_u)
            css_text = css_bytes.decode("utf-8", "ignore")
        except Exception:
            continue

        css_text2 = rewrite_css_and_collect(css_text, args.base, out, mapping)
        css_name = sha1(abs_u)[:16] + ".css"
        (css_dir / css_name).write_text(css_text2, encoding="utf-8")

        html2 = re.sub(
            r'(?is)(<link[^>]+rel=["\']stylesheet["\'][^>]*href=)(["\'])' + re.escape(href) + r'\2',
            r'\1"./css/' + css_name + r'"\2',
            html2
        )

    (out / "index.html").write_text(html2, encoding="utf-8")

    if args.zipf:
        zip_dir(out, Path(args.zipf).expanduser().resolve())

if __name__ == "__main__":
    main()
