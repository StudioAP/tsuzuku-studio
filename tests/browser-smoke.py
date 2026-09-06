#!/usr/bin/env python3
"""Optional real-browser smoke/renderer tests. See docs/TESTING.md.
No user photos are used. Does not impersonate iOS or prove native share-sheet behavior.
"""
import argparse
import json
import tempfile
import time
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:5173/')
    parser.add_argument('--browser', choices=['chromium', 'webkit', 'firefox'], default='chromium')
    parser.add_argument('--executable', default=None)
    parser.add_argument('--artifacts', default=str(ROOT / 'test-results'))
    args = parser.parse_args()
    base = args.base_url.rstrip('/') + '/'
    artifacts = Path(args.artifacts); artifacts.mkdir(parents=True, exist_ok=True)
    passed = []
    def record(name, detail=None):
        passed.append({'test': name, 'detail': detail, 'result': 'PASS'})
        print('PASS', name, detail if detail is not None else '', flush=True)
    with sync_playwright() as p:
        kwargs = {'headless': True}
        if args.executable: kwargs['executable_path'] = args.executable
        if args.browser == 'chromium': kwargs['args'] = ['--no-sandbox']
        browser = getattr(p, args.browser).launch(**kwargs)
        version = browser.version
        ctx = browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True)
        # A deliberate test double, not a claim that a desktop browser supports native file sharing.
        ctx.add_init_script("""window.__shareCalls=[];window.__shareMode='success';
          Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>!!files?.length});
          Object.defineProperty(navigator,'share',{configurable:true,value:({files})=>{
            window.__shareCalls.push({active:navigator.userActivation.isActive,names:files.map(f=>f.name),types:files.map(f=>f.type)});
            return window.__shareMode==='success'?Promise.resolve():Promise.reject(new DOMException('test share outcome',window.__shareMode==='cancel'?'AbortError':'NotAllowedError'));
          }});""")
        page = ctx.new_page(); errors = []; requests = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append((request.method, request.url)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(base)
        expect(page.locator('[data-action="choose"]')).to_be_visible()
        page.screenshot(path=str(artifacts / 'welcome-desktop.png'), full_page=True)
        page.locator('[data-action="demo"]').click()
        expect(page.locator('#preview-status')).to_contain_text('景色')
        expect(page.locator('.preview-tile')).to_have_count(5)
        expect(page.locator('#save-state')).to_have_text('この端末に保存済み')
        record('Demo → deterministic five-slide layout; local draft saved')
        page.locator('[data-action="preprocess-open"]').click()
        expect(page.locator('#preprocess-canvas')).to_be_visible()
        page.locator('#preprocess-rotation').fill('3')
        page.locator('[data-action="rotation-step"][data-value="-0.1"]').click()
        expect(page.locator('#preprocess-value-rotation')).to_have_text('2.9°')
        page.locator('[data-action="rotation-step"][data-value="0.1"]').click()
        expect(page.locator('#preprocess-value-rotation')).to_have_text('3.0°')
        assert page.locator('#preprocess-canvas').evaluate("""canvas=>{const c=canvas.getContext('2d'),p=[[0,0],[canvas.width-1,0],[0,canvas.height-1],[canvas.width-1,canvas.height-1]];return p.every(([x,y])=>{const d=c.getImageData(x,y,1,1).data;return !(d[0]===255&&d[1]===255&&d[2]===255)})}""")
        page.locator('[data-action="preprocess-preset"][data-value="square"]').click()
        assert page.locator('#preprocess-canvas').evaluate('canvas=>canvas.width===canvas.height')
        page.locator('[data-action="preprocess-apply"]').click()
        expect(page.locator('.preprocess-callout strong')).to_contain_text('正方形')
        expect(page.locator('#save-state')).to_have_text('この端末に保存済み')
        page.reload()
        expect(page.locator('.preprocess-callout strong')).to_contain_text('傾き 3°')
        assert page.locator('.block-thumb img').first.evaluate('img=>img.naturalWidth===img.naturalHeight')
        page.locator('[data-action="square-single"]').click()
        expect(page.locator('.preview-tile')).to_have_count(4)
        page.wait_for_function("()=>{const c=document.querySelector('.preview-tile canvas');if(!c)return false;const p=c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data;return p[3]===255&&(p[0]!==255||p[1]!==255||p[2]!==255)}")
        pixels = page.locator('.preview-tile canvas').first.evaluate("canvas=>{const c=canvas.getContext('2d');return {top:[...c.getImageData(canvas.width/2,8,1,1).data],middle:[...c.getImageData(canvas.width/2,canvas.height/2,1,1).data]}}")
        assert pixels['top'][:3] == [255,255,255] and pixels['middle'][:3] != [255,255,255], pixels
        expect(page.locator('.block-detail').filter(has_text='2枚につなぐ')).to_have_count(1)
        page.locator('[data-action="preprocess-open"]').click()
        page.locator('[data-action="preprocess-reset-all"]').click()
        page.locator('[data-action="preprocess-apply"]').click()
        page.locator('[data-action="span"][data-value="2"]').click()
        expect(page.locator('.preview-tile')).to_have_count(5)
        record('Photo preprocessing fine-rotates without white corners, square-crops, persists, and creates a padded single page')
        page.locator('[data-action="span"][data-value="3"]').click()
        expect(page.locator('.preview-tile')).to_have_count(6)
        page.locator('[data-action="undo"]').click(); expect(page.locator('.preview-tile')).to_have_count(5)
        page.locator('[data-action="redo"]').click(); expect(page.locator('.preview-tile')).to_have_count(6)
        page.locator('[data-action="undo"]').click()
        record('Split controls and undo/redo')
        page.locator('[data-action="theme"][data-value="paper"]').click()
        page.locator('[data-action="fit"][data-value="cover"]').click()
        page.locator('[data-action="join"]').click(); expect(page.locator('.block-card')).to_have_count(2)
        page.locator('[data-action="layout"][data-value="duo"]').click()
        page.locator('[data-action="split"]').click(); expect(page.locator('.block-card')).to_have_count(3)
        page.locator('[data-action="move"][data-index="1"][data-direction="-1"]').click()
        expect(page.locator('.block-name').first).to_contain_text('小さな緑')
        page.locator('[data-action="auto"]').click()
        expect(page.locator('.block-name').first).to_contain_text('小さな緑')
        expect(page.locator('.preview-tile')).to_have_count(5)
        record('Join, pair layout, split, reorder, and automatic relayout preserve photo order')
        page.locator('[data-action="ratio"][data-value="3:4"]').click()
        page.locator('.fine-tune summary').click()
        slider = page.locator('#range-zoom')
        slider.fill('125'); slider.dispatch_event('change')
        expect(page.locator('#value-zoom')).to_have_text('125%')
        page.locator('#format-select').select_option('png')
        expect(page.locator('#save-state')).to_have_text('この端末に保存済み')
        page.reload(); expect(page.locator('.preview-tile')).to_have_count(5)
        expect(page.locator('[data-action="ratio"][data-value="3:4"]')).to_have_attribute('aria-pressed', 'true')
        page.screenshot(path=str(artifacts / 'editor-desktop.png'), full_page=True)
        record('Ratio, zoom, output format, and draft survive reload')
        page.locator('[data-action="export"]').click()
        expect(page.locator('.output-card')).to_have_count(5, timeout=30000)
        dims = page.locator('.output-image img').evaluate_all('(xs)=>Promise.all(xs.map(async x=>{await x.decode();return [x.naturalWidth,x.naturalHeight]}))')
        assert dims == [[1080, 1440]] * 5, dims
        record('Five actual PNG outputs decode at 1080×1440', dims)
        page.locator('[data-action="share-all"]').click()
        expect(page.locator('#share-message')).to_contain_text('保存結果')
        calls = page.evaluate('window.__shareCalls')
        assert calls[-1]['active'] and len(calls[-1]['names']) == 5
        assert all(t == 'image/png' for t in calls[-1]['types'])
        assert all(name.endswith(f'-{i+1:02d}.png') for i, name in enumerate(calls[-1]['names']))
        record('Share invocation retains user activation and ordered, files-only payload')
        page.evaluate("window.__shareMode='cancel'")
        page.locator('[data-action="share-all"]').click()
        expect(page.locator('#share-message')).to_contain_text('キャンセル')
        page.evaluate("window.__shareMode='failure'")
        page.locator('[data-action="share-all"]').click()
        expect(page.locator('#share-message')).to_contain_text('1枚ずつ')
        expect(page.locator('.output-card')).to_have_count(5)
        page.evaluate("window.__shareMode='success'")
        page.locator('[data-action="share-one"]').first.click()
        assert len(page.evaluate('window.__shareCalls.at(-1).names')) == 1
        record('Native-share test doubles: cancellation, failure, and individual-file path')
        with page.expect_download() as download_info: page.locator('[data-action="export-zip"]').click()
        path = artifacts / 'sample-export.zip'; download_info.value.save_as(path)
        with zipfile.ZipFile(path) as z:
            assert len(z.namelist()) == 6
            assert z.testzip() is None
            assert '投稿の順番.txt' in z.namelist()
            z.extractall(artifacts / 'sample-export')
        record('Actual export ZIP opens in Python standard-library ZIP reader')
        page.locator('[data-action="close-dialog"]').last.click()
        page.locator('#format-select').select_option('jpeg')
        page.locator('[data-action="export"]').click()
        expect(page.locator('.output-card')).to_have_count(5, timeout=30000)
        assert all(label.endswith('.jpg') for label in page.locator('.file-label').all_text_contents())
        jpeg_dims = page.locator('.output-image img').evaluate_all('(xs)=>Promise.all(xs.map(async x=>{await x.decode();return [x.naturalWidth,x.naturalHeight]}))')
        assert jpeg_dims == [[1080,1440]] * 5
        record('JPEG export after editing invalidates PNG cache and re-encodes')
        page.locator('[data-action="close-dialog"]').last.click()
        page.locator('.project-tools details summary').click()
        with page.expect_download() as info: page.locator('[data-action="backup-save"]').click()
        backup_path = artifacts / 'roundtrip.tsuzuku'; info.value.save_as(backup_path)
        with zipfile.ZipFile(backup_path) as z: assert z.testzip() is None
        page.locator('[data-action="new"]').click()
        expect(page.locator('[data-action="demo"]')).to_be_visible()
        page.locator('#backup-input').set_input_files(backup_path)
        expect(page.locator('.preview-tile')).to_have_count(5)
        expect(page.locator('.block-name').first).to_contain_text('小さな緑')
        record('Draft export → delete local draft → import .tsuzuku restores the project')
        page.locator('#photo-input').set_input_files({'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'})
        expect(page.locator('.notice')).to_contain_text('対象外')
        expect(page.locator('.block-card')).to_have_count(3)
        record('Unsupported uploads fail clearly without corrupting existing edits')
        evil_name = 'photo<img src=x onerror=window.__xss=1>.jpg'
        page.locator('#photo-input').set_input_files({'name':evil_name,'mimeType':'image/jpeg','buffer':(ROOT/'tests/fixtures/orientation-6.jpg').read_bytes()})
        expect(page.locator('.block-card')).to_have_count(4)
        expect(page.locator('.block-name').last).to_have_text(evil_name)
        assert page.evaluate('window.__xss===undefined')
        record('User filename is rendered as text, not executable markup')
        # Geometry/PNG comparisons use a synthetic photo. Full-strip canvas exists ONLY in tests.
        comparison = page.evaluate("""async () => {
          const {newProject,makeBlock}=await import('./src/model.js');
          const {buildScene}=await import('./src/layout.js');
          const {ImagePool,importPhoto,canvasBlob,loadImage}=await import('./src/images.js');
          const {drawPage,exportPages}=await import('./src/renderer.js');
          const source=document.createElement('canvas'); source.width=2700;source.height=1700;
          const c=source.getContext('2d'); const g=c.createLinearGradient(0,0,2700,1700);g.addColorStop(0,'#ff5012');g.addColorStop(.5,'#2345af');g.addColorStop(1,'#a1cd32');c.fillStyle=g;c.fillRect(0,0,2700,1700);
          for(let x=13;x<2700;x+=57){c.fillStyle=x%2?'#224466':'#ffddaa';c.fillRect(x,0,3,1700)}
          const a=await importPhoto(new File([await canvasBlob(source,'image/png')],'test.png',{type:'image/png'}));
          const b={...a,id:crypto.randomUUID()}; const results=[];
          for(const [ratio,theme,fit,layout] of [['4:5','edge','contain','single'],['4:5','paper','cover','single'],['3:4','ink','cover','single'],['1:1','edge','contain','single'],['4:5','paper','cover','overlap'],['3:4','ink','contain','duo']]){
            const block=makeBlock(a.id,2);block.fit=fit;block.transforms[a.id]={zoom:1.13,focusX:.28,focusY:-.31};
            const assets=layout==='single'?[a]:[a,b];if(layout!=='single'){block.layout=layout;block.photoIds.push(b.id);block.transforms[b.id]={zoom:1.06,focusX:-.2,focusY:.13}}
            const scene=buildScene({...newProject(),ratio,theme,blocks:[block]},assets);const pool=new ImagePool(assets);
            const whole=document.createElement('canvas');whole.width=2160;whole.height=scene.height;const w=whole.getContext('2d',{alpha:false,willReadFrequently:true});w.fillStyle=scene.background;w.fillRect(0,0,2160,scene.height);w.imageSmoothingQuality='high';
            for(const p of scene.placements){const im=await pool.get(p.assetId);w.save();if(p.matte){w.fillStyle=scene.background;w.fillRect(p.frame.x-p.matte,p.frame.y-p.matte,p.frame.w+2*p.matte,p.frame.h+2*p.matte)}w.beginPath();w.rect(p.frame.x,p.frame.y,p.frame.w,p.frame.h);w.clip();w.drawImage(im,p.rect.x,p.rect.y,p.rect.w,p.rect.h);w.restore()}
            let changed=0,maxDiff=0,seamMaxDiff=0,totalBytes=0;
            for(let i=0;i<2;i++){const part=document.createElement('canvas');await drawPage(part,scene,i,pool,1080);const expected=w.getImageData(i*1080,0,1080,scene.height).data;const actual=part.getContext('2d').getImageData(0,0,1080,scene.height).data;totalBytes+=actual.length;for(let k=0;k<actual.length;k++){const d=Math.abs(actual[k]-expected[k]);if(d){changed++;maxDiff=Math.max(maxDiff,d);const x=Math.floor(k/4)%1080;if((i===0&&x>=1072)||(i===1&&x<8))seamMaxDiff=Math.max(seamMaxDiff,d)}}part.width=part.height=1}
            results.push({ratio,theme,fit,layout,changed,maxDiff,seamMaxDiff,totalBytes});pool.clear();whole.width=whole.height=1;
          }
          const scene=buildScene({...newProject(),blocks:[makeBlock(a.id,2)]},[a]);const files=await exportPages(scene,[a],'png');
          const first=await loadImage(files[0]);const dimensions=[first.naturalWidth,first.naturalHeight];first.src='';
          const controller=new AbortController();controller.abort();let canceled=false;try{await exportPages(scene,[a],'jpeg',null,controller.signal)}catch(e){canceled=e.name==='AbortError'}
          const transparent=document.createElement('canvas');transparent.width=2;transparent.height=2;const t=await importPhoto(new File([await canvasBlob(transparent,'image/png')],'alpha.png',{type:'image/png'}));const ti=await loadImage(t.blob);transparent.getContext('2d').drawImage(ti,0,0);const pixel=[...transparent.getContext('2d').getImageData(0,0,1,1).data];ti.src='';
          return {results,dimensions,canceled,pixel};
        }""")
        # Distinct canvas sizes can use slightly different rasterization paths.
        # A 3/255 channel tolerance, on <0.1% of bytes, permits rounding, not seams or crop shifts.
        assert all(r['maxDiff'] <= 3 and r['changed']/r['totalBytes'] < .001 and r['seamMaxDiff'] <= 3 for r in comparison['results']), comparison
        assert comparison['dimensions'] == [1080,1350]
        assert comparison['canceled'] and comparison['pixel'] == [255,255,255,255]
        record('Six two-page scenes match a unified strip within bounded rasterization tolerance', comparison)
        orientation = (ROOT / 'tests/fixtures/orientation-6.jpg').read_bytes()
        orient = page.evaluate("""async bytes=>{const {importPhoto,loadImage}=await import('./src/images.js');const a=await importPhoto(new File([new Uint8Array(bytes)],'rotated.jpg',{type:'image/jpeg'}));const data=new Uint8Array(await a.blob.arrayBuffer());return {size:[a.width,a.height],metadataRetained:new TextDecoder().decode(data).includes('Fixture - remove original EXIF')}}""", list(orientation))
        assert orient['size'] == [90,160] and not orient['metadataRetained'], orient
        record('EXIF orientation 6 is normalized; source EXIF comment not copied', orient)
        assert not errors, errors
        invalid = [(method,url) for method,url in requests if url.startswith(('http:','https:')) and (method!='GET' or not url.startswith(base))]
        assert not invalid, invalid
        record('No page exceptions, non-GET HTTP requests, or external HTTP requests in desktop scenarios')
        ctx.close()
        # Separate context: mobile layout, genuine browser capability fallback, 20-photo boundary.
        mobile = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, **({'is_mobile':True} if args.browser!='firefox' else {}))
        mobile.add_init_script("Object.defineProperty(navigator,'canShare',{configurable:true,value:undefined});")
        mp = mobile.new_page(); mp.on('dialog', lambda d:d.accept()); mp.goto(base)
        mp.screenshot(path=str(artifacts/'welcome-mobile.png'),full_page=True)
        mp.locator('[data-action="demo"]').click()
        expect(mp.locator('#preview-status')).to_contain_text('景色')
        assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
        mp.screenshot(path=str(artifacts/'editor-mobile.png'),full_page=True)
        mp.locator('[data-action="preprocess-open"]').click()
        expect(mp.locator('#preprocess-canvas')).to_be_visible()
        assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
        mp.screenshot(path=str(artifacts/'preprocess-mobile.png'),full_page=True)
        mp.locator('[data-action="preprocess-apply"]').scroll_into_view_if_needed()
        expect(mp.locator('[data-action="preprocess-apply"]')).to_be_visible()
        mp.locator('[data-action="close-dialog"]').first.click()
        mp.locator('[data-action="jump-edit"]').click()
        expect(mp.locator('[data-action="jump-preview"]')).to_be_visible()
        mp.locator('[data-action="jump-preview"]').click()
        mp.locator('[data-action="view"][data-value="swipe"]').click()
        assert mp.locator('#preview-scroll').evaluate('el=>getComputedStyle(el).scrollSnapType').startswith('x')
        mp.locator('[data-action="export"]').click(); expect(mp.locator('.output-card')).to_have_count(5,timeout=30000)
        expect(mp.locator('[data-action="share-all"]')).to_be_disabled()
        assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
        mp.screenshot(path=str(artifacts/'export-mobile.png'),full_page=True)
        with mp.expect_download() as info: mp.locator('[data-action="share-one"]').first.click()
        info.value.save_as(artifacts/'individual-fallback.jpg')
        record('390px mobile layout, preview shortcuts, swipe snap, and individual-download fallback')
        mp.locator('[data-action="close-dialog"]').last.click()
        mp.locator('.project-tools details summary').click();mp.locator('[data-action="new"]').click()
        expect(mp.locator('[data-action="demo"]')).to_be_visible()
        tiny = (ROOT/'tests/fixtures/orientation-6.jpg').read_bytes()
        mp.locator('#photo-input').set_input_files([{'name':f'photo-{i}.jpg','mimeType':'image/jpeg','buffer':tiny} for i in range(20)])
        expect(mp.locator('.block-card')).to_have_count(20,timeout=30000)
        expect(mp.locator('.preview-tile')).to_have_count(20)
        expect(mp.locator('[data-action="span"][data-value="2"]')).to_be_disabled()
        mp.locator('[data-action="export"]').click();expect(mp.locator('.output-card')).to_have_count(20,timeout=30000)
        record('Twenty-photo import and twenty-frame export; controls enforce output budget')
        mobile.close()
        unavailable=browser.new_context()
        unavailable.add_init_script("Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined})")
        up=unavailable.new_page();up.goto(base)
        expect(up.locator('#save-state')).to_have_text('端末保存を利用できません')
        up.locator('[data-action="demo"]').click()
        expect(up.locator('.preview-tile')).to_have_count(5)
        expect(up.locator('#save-state')).to_have_text('端末保存に失敗')
        up.locator('[data-action="export"]').click();expect(up.locator('.output-card')).to_have_count(5,timeout=30000)
        record('Unavailable IndexedDB shows a warning but still allows editing and export')
        unavailable.close()
        # Offline test uses a separate context and explicitly opts into SW on localhost.
        offline = browser.new_context(); op=offline.new_page();op.goto(base+'?sw')
        expect(op.locator('[data-action="demo"]')).to_be_visible()
        op.evaluate('async()=>{await navigator.serviceWorker.ready}')
        op.reload();expect(op.locator('[data-action="demo"]')).to_be_visible()
        offline.set_offline(True);op.reload();expect(op.locator('[data-action="demo"]')).to_be_visible()
        op.locator('[data-action="demo"]').click();expect(op.locator('.preview-tile')).to_have_count(5)
        op.locator('[data-action="export"]').click();expect(op.locator('.output-card')).to_have_count(5,timeout=30000)
        record('Cached app reloads, edits, and exports while offline')
        offline.close();browser.close()
        report = {'browser':args.browser,'version':version,'base_url':base,'results':passed,'native_iphone_tested':False}
        (artifacts/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(f'\n{len(passed)} browser scenarios passed. Native iPhone share-sheet/HEIC remain manual tests.')

if __name__=='__main__': main()
