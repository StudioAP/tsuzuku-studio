#!/usr/bin/env python3
"""Synthetic-photo interaction QA. Mobile viewport is not native iPhone QA."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

def in_view(locator, height):
    box = locator.bounding_box()
    return bool(box and box['y'] >= 0 and box['y'] + box['height'] <= height + 1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:5173/')
    parser.add_argument('--artifacts', default='output/playwright/efficiency')
    parser.add_argument('--audit-only', action='store_true')
    args = parser.parse_args()
    out = Path(args.artifacts); out.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width, height in [(375,667),(390,844),(320,700),(1280,800),(1440,900)]:
            context = browser.new_context(viewport={'width':width,'height':height}, has_touch=width<800)
            page = context.new_page(); errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(args.base_url)
            page.locator('[data-action="demo"]').click()
            expect(page.locator('.block-card')).to_have_count(3)
            page.locator('.block-select').first.click()
            page.wait_for_function("()=>[...document.querySelectorAll('.photo-editor-preview-page canvas')].every(c=>c.dataset.rendered==='true')")
            scroll = page.locator('.photo-editor-scroll')
            scroll.evaluate('e=>e.scrollTop=e.scrollHeight')
            row = {'viewport':[width,height], 'navigation_visible_at_bottom':in_view(page.locator('[data-action="editor-step"][data-direction="1"]'),height)}
            page.screenshot(path=str(out/f'{width}-editor-bottom.png'))
            if args.audit_only:
                page.locator('[data-action="preprocess-open"]').click()
                expect(page.locator('#preprocess-canvas')).to_be_visible()
                row['apply_visible_on_open'] = in_view(page.locator('[data-action="preprocess-apply"]'),height)
                page.locator('[data-action="preprocess-apply"]').scroll_into_view_if_needed()
                row['photo_visible_at_apply'] = in_view(page.locator('#preprocess-canvas'),height)
                page.screenshot(path=str(out/f'{width}-preprocess-bottom.png'))
            else:
                verify(page, width, height, out)
            assert not errors, errors
            results.append(row); context.close()
        browser.close()
    (out/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    print(json.dumps(results,ensure_ascii=False), flush=True)

def verify(page, width, height, out):
    next_photo = page.locator('[data-action="editor-step"][data-direction="1"]')
    assert in_view(next_photo, height)
    assert in_view(page.locator('[data-action="editor-preprocess"]'), height)
    next_y = next_photo.bounding_box()['y']
    next_photo.click()
    expect(page.locator('#photo-edit-title')).to_contain_text('小さな緑')
    assert abs(next_photo.bounding_box()['y'] - next_y) < 1
    page.locator('[data-action="editor-step"][data-direction="-1"]').click()
    expect(page.locator('#photo-edit-title')).to_contain_text('山のつづき')

    # Repeated moves use the same button position without closing the editor.
    page.locator('.editor-order summary').click()
    move = page.locator('[data-action="editor-move"][data-direction="1"]')
    move.scroll_into_view_if_needed()
    y = move.bounding_box()['y']
    move.click()
    expect(page.locator('.editor-order')).to_have_attribute('open','')
    assert abs(move.bounding_box()['y'] - y) < 1
    move.click()
    expect(move).to_be_disabled()
    assert abs(move.bounding_box()['y'] - y) < 1
    expect(page.locator('#photo-edit-title')).to_contain_text('山のつづき')
    page.locator('[data-action="editor-move"][data-target="first"]').click()
    expect(move).to_be_enabled()
    page.locator('.editor-order summary').click()

    # Open settings and individual transforms survive pair-target changes.
    page.locator('.fine-tune summary').click()
    page.locator('#range-zoom').fill('110')
    page.locator('[data-action="join"]').click()
    expect(page.locator('.fine-tune')).to_have_attribute('open','')
    targets = page.locator('.photo-editor-targets button')
    expect(targets).to_have_count(2)
    targets.nth(1).click()
    expect(page.locator('#photo-edit-title')).to_contain_text('小さな緑')
    expect(page.locator('#range-zoom')).to_have_value('100')
    page.locator('#range-zoom').fill('140')
    targets.nth(0).click()
    expect(page.locator('#range-zoom')).to_have_value('110')
    expect(page.locator('.fine-tune')).to_have_attribute('open','')
    page.wait_for_function("()=>[...document.querySelectorAll('.photo-editor-preview-page canvas')].every(c=>c.dataset.rendered==='true')")
    page.locator('[data-action="fit"][data-value="contain"]').click()
    expect(page.locator('.fine-tune')).to_have_attribute('open','')
    # Same-block repaint retains the picture rather than flashing an empty canvas.
    assert page.locator('.photo-editor-preview-page canvas').first.evaluate('c=>c.getContext("2d").getImageData(c.width/2,c.height/2,1,1).data[3]') == 255
    targets.nth(1).click()
    page.locator('.photo-editor-scroll').evaluate('e=>e.scrollTop=e.scrollHeight')
    assert in_view(targets.nth(0), height) and in_view(targets.nth(1), height)
    expect(targets.nth(1)).to_have_attribute('aria-pressed','true')
    page.wait_for_function("()=>[...document.querySelectorAll('.photo-editor-preview-page canvas')].every(c=>c.dataset.rendered==='true')")
    page.screenshot(path=str(out/f'{width}-editor-pair.png'))

    # Crop changes and confirmation remain visible together; cancel is non-destructive.
    page.locator('[data-action="editor-preprocess"]').click()
    expect(page.locator('.preprocess-photo-name')).to_contain_text('小さな緑')
    page.wait_for_function("()=>document.querySelector('#preprocess-canvas')?.width>300")
    apply = page.locator('[data-action="preprocess-apply"]')
    assert in_view(apply, height) and in_view(page.locator('#preprocess-canvas'), height)
    page.locator('.preprocess-controls').evaluate('e=>e.scrollTop=e.scrollHeight')
    page.locator('#preprocess-bottom').fill('10')
    assert in_view(apply, height) and in_view(page.locator('#preprocess-canvas'), height)
    page.screenshot(path=str(out/f'{width}-preprocess-bottom.png'))
    controls_y = page.locator('.preprocess-controls').bounding_box()['y']
    page.locator('#preprocess-bottom').fill('90')
    assert abs(page.locator('.preprocess-controls').bounding_box()['y'] - controls_y) < 1
    assert in_view(apply, height) and in_view(page.locator('#preprocess-canvas'), height)
    page.locator('.preprocess-footer [data-action="close-dialog"]').click()
    expect(page.locator('.preprocess-callout strong')).to_have_text('未調整')
    page.locator('[data-action="editor-preprocess"]').click()
    page.wait_for_function("()=>document.querySelector('#preprocess-canvas')?.width>300")
    page.locator('[data-action="preprocess-preset"][data-value="square"]').click()
    page.locator('[data-action="rotation-step"][data-value="0.1"]').click()
    apply.click()
    expect(page.locator('.preprocess-callout strong')).to_contain_text('正方形')
    expect(page.locator('.preprocess-callout strong')).to_contain_text('0.1°')
    expect(page.locator('.fine-tune')).to_have_attribute('open','')
    expect(page.locator('#range-zoom')).to_have_value('140')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-action="close-photo-editor"]').first.click()
    expect(page.locator('.block-name').first).to_contain_text('山のつづき')
    print(f'PASS {width}×{height}: fixed navigation, in-editor order, pair targets, crop and retained settings', flush=True)

if __name__ == '__main__':
    main()
