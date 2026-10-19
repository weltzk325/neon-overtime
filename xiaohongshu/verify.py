#!/usr/bin/env python3
"""Exercise the real H5 release under a local approximation of container CSP.

SDK calls below are a test double, never calls to a Xiaohongshu account. This
does not replace Builder hub preview or Android/iOS container testing.
"""
from __future__ import annotations

import functools
import http.server
import json
from pathlib import Path
import threading
import time
import zipfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'package'
ZIP = ROOT / 'neon-overtime-xhs-tool.zip'
OUT = ROOT / 'test-results.json'
SHOTS = ROOT / 'test-shots'
CSP = "; ".join([
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'none'",
    "media-src 'none'", "worker-src 'none'", "child-src 'none'",
    "object-src 'none'", "base-uri 'none'",
])

SDK = """(() => {
  window.xhs = {launchOptions:{miniToolEnv:{buildVersion:9462004}},miniTool:{
    getStorage: options => window.__nativeRead(options),
    setStorage: options => window.__nativeWrite(options),
    removeStorage: options => window.__nativeRemove(options)
  }};
  Element.prototype.replaceChildren = undefined;
  window.Worker = undefined;
  window.SharedWorker = undefined;
  window.fetch = undefined;
  window.XMLHttpRequest = undefined;
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation',e => window.__cspViolations.push(e.violatedDirective+': '+e.blockedURI));
})();"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        super().end_headers()

    def log_message(self, *args):
        pass


def wait(page, expression, timeout=20000):
    # Playwright wait_for_function evaluates its predicate with page-world eval.
    # Poll via CDP from the test host so the app CSP remains strict.
    deadline = time.monotonic() + timeout / 1000
    while time.monotonic() < deadline:
        if page.evaluate('() => (' + expression + ')'):
            return
        page.wait_for_timeout(50)
    raise TimeoutError(expression)


def capture(page, name):
    # Let the existing panel entry animations finish before visual review.
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / name))


def main():
    started = time.perf_counter()
    results = []
    errors = []
    failed_requests = []
    native = {}
    native_calls = []
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(DIST)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/index.html'
    SHOTS.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    def passed(name, details=None):
        results.append({'test': name, 'passed': True, 'details': details})

    def attach(context):
        def read(_source, options):
            assert set(options) == {'key'}
            return {'data': native.get(options['key']), 'errMsg': 'getStorage:ok'}

        def write(_source, options):
            assert set(options) == {'key', 'data'} and isinstance(options['data'], str)
            json.loads(options['data'])
            native[options['key']] = options['data']
            native_calls.append('setStorage')
            return {'errMsg': 'setStorage:ok'}

        def remove(_source, options):
            assert set(options) == {'key'}
            native.pop(options['key'], None)
            return {'errMsg': 'removeStorage:ok'}

        context.expose_binding('__nativeRead', read)
        context.expose_binding('__nativeWrite', write)
        context.expose_binding('__nativeRemove', remove)
        context.add_init_script(SDK)

    def boot(context):
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failed_requests.append(r.url) if r.status >= 400 else None)
        page.on('request', lambda r: failed_requests.append(r.url) if not r.url.startswith((url.rsplit('/', 1)[0], 'data:', 'blob:')) else None)
        t = time.perf_counter()
        page.goto(url, wait_until='load')
        wait(page, "window.G && G.game && document.getElementById('screen-boot').hidden", timeout=20000)
        assert page.evaluate("typeof window.__OVERTIME") == 'undefined'
        assert page.evaluate("OvertimeMiniTool.status().backend") == 'native'
        return page, round((time.perf_counter() - t) * 1000)

    try:
        with zipfile.ZipFile(ZIP) as package:
            names = set(package.namelist())
            assert 'index.html' in names and len([n for n in names if n.endswith('.html')]) == 1
            assert names == {p.relative_to(DIST).as_posix() for p in DIST.rglob('*') if p.is_file()}
            for name in names:
                assert package.read(name) == (DIST / name).read_bytes(), name
        passed('zip_matches_tested_release', {'files': len(names), 'bytes': ZIP.stat().st_size})
        licenses = json.loads((DIST / 'third-party-licenses.json').read_text(encoding='utf-8'))['licenseTexts']
        for record in ['assets/fonts/OFL.txt', 'assets/ui/pxlkit/LICENSE-ASSETS.txt', 'js/libs/rough.LICENSE.txt']:
            assert record in licenses and len(licenses[record]) > 100, record
        passed('license_texts_bundled_inside_upload_zip')

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--disable-gpu'])
            context = browser.new_context(viewport={'width': 1600, 'height': 900})
            attach(context)
            page, boot_ms = boot(context)
            capture(page, 'menu-desktop.png')
            passed('strict_csp_boot_without_forbidden_apis', {'boot_ms': boot_ms, 'browser': browser.version})
            page.locator('[data-weapon="laser"]').click()
            page.locator('#btn-start').click()
            wait(page, "!document.getElementById('screen-story').hidden")
            page.locator('#story-skip').click()
            wait(page, "G.game.state === 'play'")
            canvas = page.locator('#game').bounding_box()
            page.mouse.move(canvas['x'] + canvas['width'] * .7, canvas['y'] + canvas['height'] * .5)
            page.mouse.down()
            page.wait_for_timeout(400)
            assert page.evaluate('G.game.input.firing && !!G.game.player.beam')
            page.keyboard.press('Escape')
            assert page.evaluate("G.game.state === 'paused' && !G.game.input.firing && !G.game.player.beam")
            page.mouse.up()
            capture(page, 'pause-desktop.png')
            page.locator('#btn-resume').click()
            assert page.evaluate("G.game.state === 'play'")
            passed('menu_story_keyboard_mouse_pause')

            page.evaluate('G.game.loop = function() {}; G.game.pause(); G.UI.toMenu();')
            page.locator('#btn-challenges').click()
            assert page.locator('.contract-card').count() == 3
            capture(page, 'challenges-desktop.png')
            page.locator('#challenges-close').click()
            for mode in ['normal', 'sprint', 'iron', 'gauntlet']:
                for win in [False, True]:
                    page.evaluate("""({mode,win}) => {
                      const g = G.game;
                      G.UI.closeChallenges(); g.startRun('abigail','laser',false,mode);
                      g.run.time = win ? 120 : 60; g.run.kills = 12;
                      g.run.roomsCleared = win ? (mode === 'gauntlet' ? 3 : 6) : 1; g.endRun(win);
                    }""", {'mode': mode, 'win': win})
                    assert page.evaluate("!document.getElementById('screen-over').hidden")
                    wait(page, '!OvertimeMiniTool.status().pending && !OvertimeMiniTool.status().unsaved')
            records = page.evaluate('JSON.parse(JSON.stringify(G.Save.data))')
            assert records['runs'] == 2 and records['wins'] == 1
            for mode in ['sprint', 'iron', 'gauntlet']:
                assert records['challenges'][mode]['runs'] == 2
                assert records['challenges'][mode]['wins'] == 1
                assert records['challenges'][mode]['fastest'] == 120
            capture(page, 'result-desktop.png')
            passed('four_modes_results_and_isolated_records', 'Debug-assisted endRun, not a full campaign playthrough')
            page.reload()
            wait(page, 'window.G && G.game')
            assert page.evaluate('G.Save.data.challenges.gauntlet.wins') == 1
            assert page.evaluate('G.Save.data.points') == records['points']
            passed('native_storage_reload', {'native_writes': len(native_calls)})
            page.evaluate("G.game.loop = function() {}; G.game.startRun('abigail','laser',false,'gauntlet')")
            for round_id in [1, 2]:
                page.evaluate('G.game.bossDefeated(G.game.boss)')
                assert page.evaluate("G.game.state === 'levelup' && G.UI.choice.type === 'boss-upgrade'")
                assert page.locator('#choice-cards .choice-card').count() == 3
                page.locator('#choice-cards .choice-card').first.click()
                assert page.evaluate('G.game.run.bossRound') == round_id
                assert page.evaluate("G.game.state === 'play' && !!G.game.boss")
            passed('gauntlet_two_real_upgrade_choices', 'Boss deaths invoked by test, cards clicked through DOM')
            assert not page.evaluate('window.__cspViolations')
            context.close()

            mobile = browser.new_context(viewport={'width': 896, 'height': 414}, has_touch=True, is_mobile=True)
            attach(mobile)
            page, _ = boot(mobile)
            capture(page, 'menu-touch.png')
            page.locator('[data-weapon="laser"]').tap()
            page.locator('#btn-start').tap()
            wait(page, "G.game.state === 'play'")
            session = mobile.new_cdp_session(page)
            fire = page.locator('#touch-fire').bounding_box()
            point = {'x': fire['x'] + fire['width'] / 2, 'y': fire['y'] + fire['height'] / 2, 'id': 7}
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
            page.wait_for_timeout(250)
            assert page.evaluate('G.game.input.usingTouch && G.game.input.firing && !!G.game.player.beam')
            capture(page, 'laser-touch.png')
            session.send('Input.dispatchTouchEvent', {'type': 'touchCancel', 'touchPoints': []})
            assert page.evaluate('!G.game.input.firing && !G.game.player.beam')
            stick = page.locator('#stick-base').bounding_box()
            point = {'x': stick['x'] + stick['width'] / 2, 'y': stick['y'] + stick['height'] / 2, 'id': 9}
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
            point['x'] += 45
            session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [point]})
            assert page.evaluate('G.game.input.touch.x > .2')
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            assert page.evaluate('G.game.input.touch.x === 0')
            page.locator('#touch-pause').tap()
            assert page.evaluate("G.game.state === 'paused'")
            page.locator('#btn-pause-settings').tap()
            assert page.evaluate("!document.getElementById('screen-settings').hidden && !G.game.input.firing")
            capture(page, 'settings-touch.png')
            passed('real_touch_fire_cancel_stick_pause_settings', {'attack_target_px': round(fire['width'], 1)})
            page.set_viewport_size({'width': 390, 'height': 844})
            page.wait_for_timeout(150)
            assert page.evaluate("document.body.classList.contains('xhs-layout-portrait')")
            capture(page, 'portrait.png')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            # Browser hit testing follows the CSS rotation; input vectors must too.
            page.locator('#settings-close').tap()
            page.locator('#btn-resume').tap()
            fire = page.locator('#touch-fire').bounding_box()
            assert min(fire['width'], fire['height']) >= 44
            point = {'x': fire['x'] + fire['width']/2, 'y': fire['y'] + fire['height']/2, 'id': 11}
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
            page.wait_for_timeout(150)
            assert page.evaluate('G.game.input.firing && !!G.game.player.beam')
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            stick = page.locator('#stick-base').bounding_box()
            point = {'x': stick['x'] + stick['width']/2, 'y': stick['y'] + stick['height']/2, 'id': 12}
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
            point['y'] += 45
            session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [point]})
            assert page.evaluate('G.game.input.touch.x > .2 && Math.abs(G.game.input.touch.y) < .1')
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            capture(page, 'portrait-gameplay.png')
            stage = page.locator('#stage').bounding_box()
            page.mouse.move(stage['x'] + stage['width'] * .25, stage['y'] + stage['height'] * .75)
            position = page.evaluate('({x:G.game.mouseX,y:G.game.mouseY})')
            assert abs(position['x'] - 720) < 2 and abs(position['y'] - 405) < 2, position
            passed('portrait_rotated_layout_and_touch_mapping', {'attack_target_px': round(fire['width'],1), 'mouse_point':position})
            page.set_viewport_size({'width': 896, 'height': 414})
            page.wait_for_timeout(100)
            assert page.evaluate("document.body.classList.contains('xhs-layout-landscape')")
            assert not page.evaluate('window.__cspViolations')
            mobile.close()

            # Actual file:// entry, with no injected SDK or development server.
            fallback = browser.new_context(viewport={'width': 960, 'height': 540})
            page = fallback.new_page()
            page.goto((DIST / 'index.html').as_uri())
            wait(page, 'window.G && G.game')
            assert page.evaluate("OvertimeMiniTool.status().backend === 'browser'")
            passed('direct_file_preview_without_sdk')
            fallback.close()
            browser.close()
        assert not errors, errors
        assert not failed_requests, failed_requests
        passed('no_page_errors_csp_violations_external_or_missing_assets')
    except Exception as error:
        import traceback
        results.append({'test': 'integration', 'passed': False, 'error': str(error), 'trace': traceback.format_exc()})
    finally:
        server.shutdown()
    report = {
        'date': time.strftime('%Y-%m-%d', time.gmtime()), 'suite': 'Xiaohongshu miniTool H5 release',
        'environment': 'Local Chromium; SDK test double; CSP approximated from public documentation',
        'not_tested': ['Builder hub upload/preview', 'Android/iOS Xiaohongshu container', 'Actual Chrome 61 binary', 'Unassisted full campaign'],
        'duration_ms': round((time.perf_counter() - started) * 1000), 'results': results,
        'page_errors': errors, 'bad_requests': failed_requests,
        'passed': sum(r['passed'] for r in results), 'failed': sum(not r['passed'] for r in results),
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
    return 1 if report['failed'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
