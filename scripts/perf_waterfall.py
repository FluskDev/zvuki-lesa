"""Detailed waterfall analysis with precise transfer sizes via Performance API."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright


async def detailed_measure(url: str, label: str, viewport: dict) -> dict:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=viewport)
        page = await ctx.new_page()

        # Capture timing for all resources
        await page.goto(url, wait_until="networkidle", timeout=60000)

        # Extract all resource entries from Performance API
        entries = await page.evaluate("""
        () => {
            const resources = performance.getEntriesByType('resource');
            return resources.map(r => ({
                name: r.name.replace(location.origin, ''),
                initiatorType: r.initiatorType,
                duration: Math.round(r.duration),
                startTime: Math.round(r.startTime),
                responseEnd: Math.round(r.responseEnd),
                transferSize: r.transferSize,
                encodedBodySize: r.encodedBodySize,
                decodedBodySize: r.decodedBodySize,
                renderBlockingStatus: r.renderBlockingStatus,
                nextHopProtocol: r.nextHopProtocol,
            }));
        }
        """)

        # Sort by startTime
        entries.sort(key=lambda x: x["startTime"])

        # JS module analysis via fetch of bundle
        scripts = [e for e in entries if e["name"].endswith(".js") or "script" in (e.get("initiatorType") or "").lower()]
        styles = [e for e in entries if e["name"].endswith(".css")]
        images = [e for e in entries if any(e["name"].lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"])]
        fonts = [e for e in entries if "font" in (e.get("initiatorType") or "").lower() or "woff" in e["name"].lower()]

        # LCP element identification
        lcp_info = await page.evaluate("""
        () => {
            return new Promise((resolve) => {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const last = entries[entries.length - 1];
                    if (last) {
                        const el = last.element;
                        resolve({
                            tagName: el?.tagName,
                            src: el?.src?.replace(location.origin, '') || el?.currentSrc?.replace(location.origin, ''),
                            size: el ? `${el.naturalWidth}x${el.naturalHeight}` : null,
                            lcp_time: last.startTime,
                        });
                    } else {
                        resolve(null);
                    }
                });
                observer.observe({ type: 'largest-contentful-paint', buffered: true });
                setTimeout(() => resolve(null), 1500);
            });
        }
        """)

        # Section visibility check
        section_info = await page.evaluate("""
        () => {
            const sections = document.querySelectorAll('section, [data-section]');
            return Array.from(sections).map(s => ({
                id: s.id,
                class: s.className?.substring(0, 60),
                visible: s.offsetHeight > 0 && s.offsetWidth > 0,
                height: s.offsetHeight,
                top: s.getBoundingClientRect().top + window.scrollY,
            }));
        }
        """)

        await browser.close()

        return {
            "label": label,
            "url": url,
            "viewport": viewport,
            "resource_count": len(entries),
            "total_transfer_kb": round(sum(e["transferSize"] for e in entries) / 1024, 1),
            "total_decoded_kb": round(sum(e["decodedBodySize"] for e in entries) / 1024, 1),
            "resources": entries,
            "summary": {
                "scripts_kb": round(sum(e["transferSize"] for e in scripts) / 1024, 1),
                "styles_kb": round(sum(e["transferSize"] for e in styles) / 1024, 1),
                "images_kb": round(sum(e["transferSize"] for e in images) / 1024, 1),
                "fonts_kb": round(sum(e["transferSize"] for e in fonts) / 1024, 1),
                "script_count": len(scripts),
                "image_count": len(images),
                "style_count": len(styles),
                "font_count": len(fonts),
            },
            "lcp_element": lcp_info,
            "sections_count": len(section_info),
        }


async def main():
    out_dir = Path(r"C:\Users\VallfIK\Desktop\Project\Site_Brother\app\dist_perf")
    out_dir.mkdir(exist_ok=True)

    desktop = {"width": 1350, "height": 940}

    print("Detailed measurement: / (desktop)")
    home = await detailed_measure("http://127.0.0.1:4173/", "home_desktop", desktop)
    out_dir.joinpath("waterfall_home.json").write_text(json.dumps(home, indent=2, ensure_ascii=False))

    print("Detailed measurement: /booking/shale-uyut (desktop)")
    internal = await detailed_measure("http://127.0.0.1:4173/booking/shale-uyut", "internal_desktop", desktop)
    out_dir.joinpath("waterfall_internal.json").write_text(json.dumps(internal, indent=2, ensure_ascii=False))

    # Print summary
    for r, name in [(home, "HOME"), (internal, "INTERNAL")]:
        s = r["summary"]
        print(f"\n{name}:")
        print(f"  Total resources: {r['resource_count']}")
        print(f"  Total transferred: {r['total_transfer_kb']} KB")
        print(f"  Scripts: {s['script_count']} ({s['scripts_kb']} KB)")
        print(f"  Styles: {s['style_count']} ({s['styles_kb']} KB)")
        print(f"  Images: {s['image_count']} ({s['images_kb']} KB)")
        print(f"  Fonts: {s['font_count']} ({s['fonts_kb']} KB)")
        print(f"  LCP element: {r['lcp_element']}")


if __name__ == "__main__":
    asyncio.run(main())
