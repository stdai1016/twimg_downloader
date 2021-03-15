// ==UserScript==
// @name         twimg Downloader
// @name:zh-TW   twimg Downloader
// @description  A small tool for download photos easily
// @description:zh-tw 方便下載推特圖片的小工具
// @match        https://twitter.com/*
// @match        https://mobile.twitter.com/*
// @version      0.6.16b
// @license      MIT
// @require      https://code.jquery.com/jquery-3.5.1.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.5.0/jszip.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/** @brief A small tool for download photos easily
 *  @attention For Firefox, you do not have to disable the CSP flag now.
 */

/* jshint esversion: 6 */
/* global $, JSZip */

(function () {
  'use strict';

  /* ======= STORAGE ======= */
  const DEFAULT_VALUE = {
    fmt_g: 'twitter {tweet}-gif{pno}', // gif
    fmt_v: 'twitter {tweet}-vid{pno}', // video
    fmt_p: 'twitter {tweet}-img{pno}', // photo
    fmt_z: 'twitter {tweet}', // zip
    zip: true
  };
  (function initStorage () {
    Object.keys(DEFAULT_VALUE).forEach(k => {
      if (typeof GM_getValue(k) !== typeof DEFAULT_VALUE[k]) {
        GM_setValue(k, DEFAULT_VALUE[k]);
      }
    });
  })();
  function valueGetSet (key, val = null) {
    if (val != null) GM_setValue(key, val);
    return GM_getValue(key);
  }
  function fmtPhotoName (val = null) { return valueGetSet('fmt_p', val); }
  function fmtZipName (val = null) { return valueGetSet('fmt_z', val); }
  function zipped (val = null) { return valueGetSet('zip', val); }

  /** Get/set format of filename, available format names:
   *  * {base} (basename of url)
   *  * {tweet} (tweet id)
   *  * {pno} (photo number)
   *  * and {user} (who post the tweet)
   */
  function getFileName (fmt, opt) {
    return fmt.replace(/{(\w+)}/g, function (m, w) {
      return opt[w] ? opt[w] : w;
    }).replace(/[/|\\?"*:<>]/g, '_');
  }

  /* ======= ACTION ======= */
  const FMT_TWEET = /^https:\/\/(?:mobile.|)twitter\.com\/(\w+)\/status\/(\d+)/;
  const FMT_PHOTO =
    /^https:\/\/(?:mobile.|)twitter\.com\/(\w+)\/status\/(\d+)\/photo\/(\d)$/;
  const FMT_MEDIA_LEGACY = /^(https?:\/\/.+)\.(\w+)(?::(\w+)|)$/;
  const FMT_MEDIA_MODERN = /^(https?:\/\/.+)\?format=(\w+)&name=(\w+)$/;
  function getUrlOrig (url, legacy = false) {
    const f = legacy ? ['.', ':'] : ['?format=', '&name='];
    const m = url.match(FMT_MEDIA_MODERN) || url.match(FMT_MEDIA_LEGACY);
    return m ? m[1] + f[0] + m[2] + f[1] + 'orig' : '';
  }
  function getBasename (url) {
    const m = url.match(FMT_MEDIA_MODERN) || url.match(FMT_MEDIA_LEGACY);
    if (m) return m[1].split('/').pop();
    url = url.split('/').pop();
    const i = url.lastIndexOf('.');
    return i < 0 ? url : url.substr(0, i);
  }
  function getExtension (url) {
    const m = url.match(FMT_MEDIA_MODERN) || url.match(FMT_MEDIA_LEGACY);
    return m ? '.' + m[2] : '';
  }
  function getBlob (url, name = null) {
    name = name || url.split('/').pop();
    return new Promise(function (resolve, reject) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.onerror = function () { reject(new Error('Network error')); };
        xhr.onload = function () {
          if (xhr.status === 200) resolve({ blob: xhr.response, name: name });
          else reject(new Error('Loading error:' + xhr.statusText));
        };
        xhr.send();
      } catch (e) { reject(e.message); }
    });
  }
  function downloadImages (nodes) {
    const promises = [];
    const id = nodes[0].href.match(FMT_TWEET)[2];
    const user = nodes[0].href.match(FMT_TWEET)[1];
    nodes.forEach(a => {
      const url = findPhotoUrl($(a))[0];
      const m = a.href.match(FMT_PHOTO);
      let n = getFileName(fmtPhotoName(),
        { base: getBasename(url), tweet: m[2], user: m[1], pno: m[3] });
      n += getExtension(url);
      promises.push(getBlob(url, n));
    });
    if (promises.length > 1 && zipped()) {
      Promise.all(promises).then(function (res) {
        console.debug('Making zip file...');
        const zip = new JSZip();
        res.forEach(r => { zip.file(r.name, r.blob); });
        zip.generateAsync({ type: 'blob' }).then(function (blob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = getFileName(fmtZipName(),
            { base: id, tweet: id, user: user, pno: 0 });
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 6e4);
        });
      });
    } else {
      promises.forEach(p => {
        p.then(function (res) {
          const a = document.createElement('a');
          a.download = res.name;
          a.href = URL.createObjectURL(res.blob);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 6e4);
        });
      });
    }
  }
  function findTweetId ($tweet) {
    let id = null;
    $tweet.find('a').each(function () {
      if (!id) {
        const m = this.href.match(/\/status\/(\d+)\/likes/);
        id = m ? m[1] : null;
      }
    });
    $tweet.find('a').each(function () {
      if (!id) {
        const m = this.href.match(FMT_TWEET);
        id = m ? m[2] : null;
      }
    });
    return id;
  }
  function findPhotoNodes ($tweet) {
    const nodes = [];
    $tweet.find('a').each(function () {
      if (this.href.match(FMT_PHOTO)) nodes.push(this);
    });
    nodes.sort((a, b) => {
      const ma = a.href.match(FMT_PHOTO);
      const mb = b.href.match(FMT_PHOTO);
      if (ma[2] !== mb[2]) return parseInt(ma[2]) > parseInt(mb[2]) ? 1 : -1;
      return ma[3] - mb[3];
    });
    return nodes;
  }
  function findPhotoUrl ($a) {
    const urls = [];
    $a.find('img').each(function () {
      const url = getUrlOrig($(this).attr('src'));
      if (url) urls.push(url);
      // if (url.match(/pbs\.twimg\.com\/media\//)) urls.push(url);
    });
    return urls;
  }

  /* ======= UI ======= */
  /* selector */
  const SEL_TWEET = 'div[data-testid="tweet"]';
  const SEL_BTN = 'div.r-11cpok1[role="button"]:not([data-testid])';
  // const SEL_MENU_ = 'div[role="menu"]';
  const SEL_MENU_I = 'div[role="menuitem"]';
  const SEL_DIALOG = 'div.r-17gur6a[role="dialog"]';
  /* button */
  const MENU_I_DL = '<div role="menuitem" data-focusable="true" tabindex="0"' +
    ' class="css-1dbjc4n r-1loqt21 r-18u37iz r-1ny4l3l' +
    ' r-1j3t67a r-9qu9m4 r-o7ynqc r-6416eg r-13qz1uu">' +
    '<div class="css-1dbjc4n r-16y2uox r-1wbh5a2">' +
    '<div dir="auto" class="css-901oao r-jwli3a r-1qd0xha' +
    ' r-a023e6 r-16dba41 r-ad9z0x r-bcqeeo r-qvutc0">' +
    '<span class="css-901oao css-16my406 r-1qd0xha r-ad9z0x' +
    ' r-bcqeeo r-qvutc0">Download Image' +
    '</span></div></div></div>';
  /* tweet */
  function modifyTweet ($tweet) {
    $tweet = $tweet.parent();
    const tid = findTweetId($tweet);
    const nodes = [];
    findPhotoNodes($tweet).forEach(a => {
      if (a.href.match(FMT_PHOTO)[2] === tid) nodes.push(a);
    });
    console.info('Tweet ' + tid + ': ' + nodes.length);
    if (nodes.length) {
      const $btnShare = $tweet.find(SEL_BTN);
      $btnShare.on('click', function () {
        const $menuitem = $(MENU_I_DL).on('click', e => {
          e.preventDefault();
          downloadImages(nodes);
        });
        insertMenuitem($menuitem);
      });
    }
  }

  /* photo dialog */
  function modifyDialog ($dialog) {
    const $btnShare = $dialog.find(SEL_BTN);
    if (!$btnShare.length) { setTimeout(modifyDialog, 72, $dialog); return; }
    $btnShare.on('click', function () {
      const m = window.location.href.match(FMT_PHOTO);
      console.info(`Tweet ${m[2]}-${m[3]}`);
      const item = $dialog.find('li[role="listitem"]')[parseInt(m[3]) - 1];
      const url = (item || $dialog[0])
        .querySelector('div[style^=background-image]')
        // eslint-disable-next-line no-useless-escape
        .style.backgroundImage.match(/url\(\"(.+)\"\)/)[1];
      const im = $(`<img src="${url}">`)[0];
      const a = $(`<a href=${window.location.href}></a>`).append(im)[0];
      const $menuitem = $(MENU_I_DL).on('click', e => {
        e.preventDefault();
        downloadImages([a]);
      });
      insertMenuitem($menuitem);
    });
  }

  /* menu */
  function insertMenuitem ($menuitem) {
    console.debug('[called] insertMenuitem');
    getMenu().then(menu => {
      $menuitem.on('click', function (e) {
        e.preventDefault();
        menu.parentNode.childNodes[0].click(); // click background
      });
      const $menuitem0 = $(menu.querySelector(SEL_MENU_I));
      $menuitem.attr('class', $menuitem0.attr('class')).removeClass('r-1cuuowz');
      $menuitem0.before($menuitem);
    });
  }
  function getMenu (timeout = 1000) {
    return new Promise((resolve, reject) => {
      const h = setTimeout(function () {
        console.debug('[timeout] getMenu');
        stop();
        const m = document.body.querySelector('#layers [role=menu]');
        if (m) resolve(m);
        else reject(Error('timeout'));
      }, timeout);
      const menuMO = new MutationObserver(r => r.forEach(mu => {
        const m = mu.target.querySelector('[role=menu]');
        if (m) {
          stop();
          resolve(m);
        }
      }));
      menuMO.observe(document.querySelector('#layers'),
        { childList: true, subtree: true });
      function stop () {
        clearTimeout(h);
        menuMO.disconnect();
      }
    });
  }

  /* mutations */
  function handleAddedNode (mutation) {
    if (mutation.addedNodes.length === 0) return;
    mutation.addedNodes.forEach(node => {
      // <div data-testid="tweet">
      $(node).find(SEL_TWEET).each(function () {
        if ($(this).hasClass('dl-orig')) return;
        $(this).addClass('dl-orig');
        console.debug('Added: tweet');
        setTimeout(modifyTweet, 72, $(this));
      });
      // <div role="dialog">
      $(node).find(SEL_DIALOG).each(function () {
        if ($(this).hasClass('dl-orig')) return;
        $(this).addClass('dl-orig');
        console.debug('Added: dialog');
        setTimeout(modifyDialog, 72, $(this));
      });
    });
  }
  const mo = new MutationObserver(r => { r.forEach(handleAddedNode); });
  mo.observe(document.body, { childList: true, subtree: true });
})();
