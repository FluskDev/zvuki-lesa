"""Performance diagnostic: Lighthouse-style metrics via Playwright."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright


async def measure_page(url: str, viewport: dict, label: str) -> dict:
    """Measure core web vitals and resource waterfall for a URL."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=viewport)
        page = await ctx.new_page()

        # Track resources
        resources = []
        page.on("response", lambda r: resources.append({
            "url": r.url,
            "status": r.status,
            "type": r.request.resource_type,
            "size": 0,  # filled later via headers
        }))

        # Track request sizes
        async def handle_response(response):
            try:
                headers = await response.headers_array()
                # Find the existing entry
                for res in resources:
                    if res["url"] == response.url:
                        res["status"] = response.status
                        break
                body = await response.body()
                for res in resources:
                    if res["url"] == response.url:
                        res["size"] = len(body)
                        break
            except Exception:
                pass

        page.on("response", lambda r: asyncio.create_task(handle_response(r)))

        # Navigate and time
        import time
        t0 = time.time()
        await page.goto(url, wait_until="networkidle", timeout=60000)
        t1 = time.time()

        # Collect web vitals via PerformanceObserver
        metrics = await page.evaluate("""
        () => {
            return new Promise((resolve) => {
                const result = {
                    fcp: null,
                    lcp: null,
                    cls: 0,
                    tbt: 0,
                    longTasks: [],
                    domContentLoaded: null,
                    loadComplete: null,
                    transferSize: 0,
                    decodedBodySize: 0,
                };
                const nav = performance.getEntriesByType('navigation')[0];
                if (nav) {
                    result.domContentLoaded = nav.domContentLoadedEventEnd;
                    result.loadComplete = nav.loadEventEnd;
                    result.transferSize = nav.transferSize;
                    result.decodedBodySize = nav.decodedBodySize;
                }
                // FCP
                const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
                if (fcpEntry) result.fcp = fcpEntry.startTime;

                // LCP via PerformanceObserver
                try {
                    const lcpObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        const last = entries[entries.length - 1];
                        result.lcp = last.startTime;
                    });
                    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

                    // CLS
                    const clsObserver = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (!entry.hadRecentInput) {
                                result.cls += entry.value;
                            }
                        }
                    });
                    clsObserver.observe({ type: 'layout-shift', buffered: true });

                    // Long tasks for TBT
                    const ltObserver = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            result.longTasks.push({
                                duration: entry.duration,
                                startTime: entry.startTime,
                            });
                            result.tbt += Math.max(0, entry.duration - 50);
                        }
                    });
                    ltObserver.observe({ type: 'longtask', buffered: true });
                } catch (e) {}

                setTimeout(() => resolve(result), 2000);
            });
        }
        """)

        # Count DOM nodes
        dom_count = await page.evaluate("() => document.querySelectorAll('*').length")

        # Image count
        img_count = await page.evaluate("() => document.querySelectorAll('img').length")
        img_with_lazy = await page.evaluate("() => document.querySelectorAll('img[loading=\"lazy\"]').length")

        # Get the visible hero/largest image
        hero_info = await page.evaluate("""
        () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.map(i => ({
                src: i.src.replace(location.origin, '').substring(0, 80),
                loading: i.loading,
                decoding: i.decoding,
                fetchpriority: i.getAttribute('fetchpriority'),
                w: i.naturalWidth,
                h: i.naturalHeight,
                cw: i.width,
                ch: i.height,
            })).slice(0, 20);
        }
        """)

        await browser.close()

        return {
            "label": label,
            "url": url,
            "viewport": viewport,
            "total_nav_time_ms": round((t1 - t0) * 1000),
            "metrics": metrics,
            "dom_count": dom_count,
            "img_count": img_count,
            "img_with_lazy": img_with_lazy,
            "hero_info": hero_info,
            "resource_count": len(resources),
            "total_transferred_kb": round(sum(r["size"] for r in resources) / 1024, 1),
        }


async def main():
    out_dir = Path(r"C:\Users\VallfIK\Desktop\Project\Site_Brother\app\dist_perf")
    out_dir.mkdir(exist_ok=True)

    desktop = {"width": 1350, "height": 940}
    mobile = {"width": 412, "height": 915, "deviceScaleFactor": 2, "isMobile": True, "hasTouch": True}

    results = []

    print("Measuring / (desktop)...")
    r = await measure_page("http://127.0.0.1:4173/", desktop, "home_desktop")
    results.append(r)

    print("Measuring / (mobile)...")
    r = await measure_page("http://127.0.0.1:4173/", mobile, "home_mobile")
    results.append(r)

    # Try to find an internal page
    booking_url = None
    for cand in ["/booking/shale-uyut", "/booking/lesnaya-rezidenciya", "/search"]:
        try:
            import urllib.request
            req = urllib.request.Request(f"http://127.0.0.1:4173{cand}", method="HEAD")
            resp = urllib.request.urlopen(req, timeout=5)
            if resp.status == 200:
                booking_url = f"http://127.0.0.1:4173{cand}"
                print(f"Using internal page: {cand}")
                break
        except Exception:
            pass

    if booking_url:
        print(f"Measuring {booking_url} (desktop)...")
        r = await measure_page(booking_url, desktop, "internal_desktop")
        results.append(r)
        print(f"Measuring {booking_url} (mobile)...")
        r = await measure_page(booking_url, mobile, "internal_mobile")
        results.append(r)

    out_file = out_dir / "perf_report.json"
    out_file.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\nReport written: {out_file}")
    print("\n=== SUMMARY ===")
    for r in results:
        m = r["metrics"]
        print(f"\n{r['label']} ({r['viewport']['width']}x{r['viewport']['height']}):")
        print(f"  Total nav: {r['total_nav_time_ms']} ms")
        print(f"  FCP: {m['fcp']:.0f} ms" if m['fcp'] else "  FCP: N/A")
        print(f"  LCP: {m['lcp']:.0f} ms" if m['lcp'] else "  LCP: N/A")
        print(f"  CLS: {m['cls']:.4f}")
        print(f"  TBT: {m['tbt']:.0f} ms ({len(m['longTasks'])} long tasks)")
        print(f"  DOM nodes: {r['dom_count']}")
        print(f"  Images: {r['img_count']} (lazy: {r['img_with_lazy']})")
        print(f"  Resources: {r['resource_count']} ({r['total_transferred_kb']} KB)")


if __name__ == "__main__":
    asyncio.run(main())
