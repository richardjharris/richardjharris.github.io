/*
JLSE Hacks, original version by YOU (http://japanese.stackexchange.com/users/100,
see also http://stackapps.com/questions/2449/hacks-for-jlu-site)
under the CC-BY-SA license, with modifications by cypher
(http://japanese.stackexchange.com/users/796)

This allows entering Furigana with the following syntaxes:
* [漢字]{かんじ}, [漢字]【かんじ】, [漢字]｛かんじ｝
* 漢字{かんじ}, 漢字【かんじ】, 漢字｛かんじ｝
* ひらがな{hiragana}, ひらがな【hiragana】
(see also http://en.wikipedia.org/wiki/Furigana for information about what Furigana is).

It searches backwards to allow entering Japanese words with Okurigana, for example
話す{はなす} will display "はな" on top of "話" and ignore the "す" in the default 
(Furigana) mode.
This is useful for SEO as Google wouldn't index properly if 話{はな}す was typed.
In "hide furigana texts, only show when mousing over kanji" mode, in this instance it
would display a popup of "はなす" if "話す" was moused over.

More complicated compound words are also supported, but you have to use
[繰り返す]{くりかえす}/[繰り返す]【くりかえす】/[繰り返す]｛くりかえす｝ syntax as normally 
this script only goes back to the last Kanji it can find.

It does, however, search to the left of the Kanji in the case of a single "お" or "ご"
before Kanji if the Furigana also contains one of those characters, for example 
お父さん{おとうさん} to allow for Japanese honorific prefixes (see also
http://en.wikipedia.org/wiki/Honorific_speech_in_Japanese#Honorific_prefixes).

It's possible to separate characters with any of the following characters: .、。・－-／｡
so for example 気取る{き・ど・る} or 気取る{き・ど・} will display "き" on "気", "ど" on "取" and not
display anything on "る".

HL format pitch tones are supported, for example ありがとう【LHLLL】 will display a red 
line below "あ" and a red line above "り" before falling down again for "がとう".

It also:

* makes sure Japanese text is displayed using a Japanese font to fix
  the issues in Google Chrome:
  http://meta.japanese.stackexchange.com/questions/1141
* makes <pre> and <code> tags which have Japanese text in them use a
  Japanese monospace font so as to fix
  http://meta.japanese.stackexchange.com/questions/1162 and
  http://meta.japanese.stackexchange.com/questions/1023
* includes fixes to make ruby work with Firefox/WebKit/Blink's font adjust on mobile
  (http://chat.stackexchange.com/transcript/511?m=17474056)
* removes Furigana markup from the titlebar for aesthetic reasons
* and makes IPA display with a font that can display IPA inside [[...]],
  //...// or [/.../] tags as at
  http://meta.japanese.stackexchange.com/questions/1287
  (note that this only works in non-pre/code tags)
*/


$(function () {

    var DEBUG_MODE = false, // disable this before release!
        DEBUG = DEBUG_MODE ? '_dbg' : '';

    //ruby mode regex
    var replacesText = (
            // [飛び越える]{とびこえる} syntax
            '(?:#&91;|\\[)([おご]?)([^\\]]+)\\][{｛【]([^}｝】]+)[}｝】]|' +
                // 漢字{かんじ} syntax
                '([おご]?)([一-ﻭ〃〄々〆〇〒]+[ぁ-ヾ]*)\\s*[{【｛]([.、。ぁ-ヾ－-／｡＜＞（）\\(\\)≪≫；;：:！!＝=≡≠≒＄￥？\\?＆＃#＠@“‘”’hlHL]+)[}】｝]|' +
                // ひらがな{hiragana} syntax (is this ever used?)
                '([ぁ-ヾ]+)\\s*[{【]([a-zA-Zā-ō\' ]+)[}】]'
        ),
        furiganaElms = 'span,code:not(.noFurigana),p,li,b,i,em,strong,a,div.excerpt,a.question-hyperlink h2, ' +
            's,blockquote,del,dd,dt,kbd,sup,sub,strike,h1,h2,h3,h4,h5,h6',
        replaces = new RegExp(replacesText, 'g'),


        kanjiSplitText = '[..、。・－-／｡]',
        reKanjiSplit = new RegExp(kanjiSplitText, 'g'),

        // These marks are used for emphasis rather than
        // Furigana, so popups aren't displayed on them by themselves
        emphasisChars = '◦﹆﹅、..、。・－-｡',

        // cache for making sure Furigana isn't processed
        // on elements which have already been processed.
        cache = [],

        // regex for detecting Japanese text (for making sure
        // Japanese text is displayed using Japanese rather than
        // Chinese etc fonts).
        jaRegExpText = '[一-龠]+|[ぁ-ゔ]+|[ァ-ヴー]+|[ａ-ｚＡ-Ｚ０-９]+|[々〆〤、；！？「」【】『』。＜＞〜（）　]+',
        jaRegExp = new RegExp('(' + replacesText + '|' + jaRegExpText + ')+', 'g'),


        // [...] and /.../ syntax for specifying IPA fonts
        // This only works in between non-alphanumeric characters
        // to prevent e.g. hyperlinks from using an IPA font because
        // of "/" characters





        isJLSE = location.href.indexOf('japanese.stackexchange') != -1,


        ipaRegExpText =
            // Also includes e.g. {{zh-CN:(chinese text)}} syntax
            '{{([A-z\\-_]+?):(.+?)}}|' +


                '({{pad}})' +


                // Only use IPA syntax for JLSE, as it may
                // conflict with certain anime/manga SE content
                (isJLSE ? (
                    '|\\[\\[(.*?)\\]\\]|' +
                        '//(.*?)//|' +
                        '\\[/(.*?)/\\]'
                ) : ''),
        ipaRegExp = new RegExp(ipaRegExpText, 'g');


    var entityMap = {
        "&": '&amp;',
        "<": '&lt;',
        ">": '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
    };

    function escapeHtml(string) {
        return String(string).replace(/[&<>"'\/]/g, function (s) {
            return entityMap[s];
        });
    }


    function escapeReplace(o, re, str, fn) {
        // Runs function "fn" for each match in string "str" against regular expression

        // "re", while HTML escaping and outputting all non-matching text.
        // "fn" is bound to object "o".

        str = String(str);
        re.lastIndex = 0;

        var a = [],
            prevIndex = 0,
            match;

        while (match = re.exec(str)) {
            if (prevIndex != match.index) {
                a.push(escapeHtml(str.slice(prevIndex, match.index)));
            }
            a.push(fn.apply(o, match));

            prevIndex = re.lastIndex;
        }

        if (prevIndex != str.length) {
            a.push(escapeHtml(str.slice(prevIndex, str.length)));
        }

        return a.join('');
    }


    function textNodeFilter(selector, o, fn) {
        // Process any text nodes both directly contained in "o",
        // as well as any text nodes in child nodes which match
        // "selector"

        var cn = o.childNodes,
            c;

        for (var i = 0; i < cn.length; i++) {
            c = cn[i];

            if (c.nodeType == 3 /*TEXT_NODE*/ && c.data) {
                fn.apply(c, [o]);
            }
        }

        $(selector, o).each(function () {
            var parent = this;

            $(this).contents().each(function () {
                if (this.nodeType == 3 && this.data) {
                    fn.apply(this, [parent]);
                }
            });
        });
    }

    // http://stackoverflow.com/questions/5560248
    function shadeBlend(p, c0, c1) {
        var n = p < 0 ? p * -1 : p, u = Math.round, w = parseInt;
        if (c0.length > 7) {
            var f = c0.split(','), t = (c1 ? c1 : p < 0 ? 'rgb(0,0,0)' : 'rgb(255,255,255)').split(','), R = w(f[0].slice(4)), G = w(f[1]), B = w(f[2]);
            return 'rgb(' + (u((w(t[0].slice(4)) - R) * n) + R) + ',' + (u((w(t[1]) - G) * n) + G) + ',' + (u((w(t[2]) - B) * n) + B) + ')';
        } else {
            var f = w(c0.slice(1), 16), t = w((c1 ? c1 : p < 0 ? '#000000' : '#FFFFFF').slice(1), 16), R1 = f >> 16, G1 = f >> 8 & 0x00FF, B1 = f & 0x0000FF;
            return '#' + (0x1000000 + (u(((t >> 16) - R1) * n) + R1) * 0x10000 + (u(((t >> 8 & 0x00FF) - G1) * n) + G1) * 0x100 + (u(((t & 0x0000FF) - B1) * n) + B1)).toString(16).slice(1);
        }
    }


    var ruby = {
        start: function () {

            this.addMenu();
            this.addOptionsBox();


            if (this.mode == 'uDisableRubyEngine') {
                // don't run if ruby disabled altogether in the "Furigana options"
                return;
            }

            this.addEditHelp();
            this.addStyles();
            this.loop();
            setInterval($.proxy(this.loop, this), 800);


            this.resizeCheck();
            $(window).resize($.proxy(this.resizeCheck, this));
            this.resizeLoop();

            this.fixTitle();

            if ($.trim(location.pathname.replace('/', '')) == 'editing-help') {
                this.addToMarkdownHelp();
            }
        },

        addToMarkdownHelp: function () {
            $('<div class="col-section">' +
                '<h2 id="link-linebreaks">Japanese Language Extensions</h2>' +
                '<p>' +
                'This Stack Exchange site includes custom JavaScript which provides Furigana, ' +
                'Japanese pitch accents and other functionality. ' +
                '</p>' +
                '<p>See also ' +
                '<a href="http://meta.japanese.stackexchange.com/questions/806/how-should-i-format-my-questions-on-japanese-language-se">' +
                'How should I format my questions on Japanese Language SE?' +
                '</a> for more information.' +
                '</p>',
                '</div>').insertBefore($('.col-section').first());

        },

        fixTitle: function () {
            // Remove Furigana in the browser's title bar
            document.title = document.title.replace(replaces, function ($0, $1, $2, $3, $4, $5, $6, $7, $8, $9) {
                var kanji = $2 || $5 || $7 || $9,
                    honorific = $1 || $4 || '';
                return honorific + kanji;
            });
        },

        addCSS: function (css) {
            var head = document.getElementsByTagName('head')[0],
                style = document.createElement('style');

            style.type = 'text/css';
            if (style.styleSheet) {
                style.styleSheet.cssText = css;
            } else {
                style.appendChild(document.createTextNode(css));
            }

            head.appendChild(style);
        },

        // "Furigana options"-related
        // This is displayed near the bottom of the screen,
        // in the nav bar with "contact us" etc in it.


        addMenu: function () {
            // Add the "furigana options" menu link to the nav near the bottom of the screen
            if ($('#upopuphyperlink').length) {
                $('#upopuphyperlink').remove();
                $('#upopup').remove();
            }


            var addTo = $('#footer-menu .top-footer-links, .footer-links'); // .footer-links for mobile


            addTo.prepend(
                '<a id="upopuphyperlink" style="font-weight: bold; border: 1px dashed;">Japanese&nbsp;options&nbsp;&#9660;</a><div id="upopup"></div>'
            );


            $('#upopuphyperlink').click(function () {
                var a = $('#upopuphyperlink')[0];
                $('#upopup').toggle();
                $('#upopup').css('top', a.offsetTop - $('#upopup').height() - 15 + 'px');
                $('#upopup').css('left', a.offsetLeft + 'px');
            });
        },


        addOptionsBox: function () {
            this.addCSS(
                '#upopup, #utransoptions {' +
                'color:black;position:absolute;' +
                'display:none;background-color:#fff;border:1px solid #ccc;margin-top:3px;padding:5px;z-index:500;' +
                'box-shadow:1px 1px 2px rgba(0,0,0,0.2);}' +
                '#upopup td {text-transform: none !important; padding: 0 0 4px 0 !important;}'
            );


            // Add "furigana options" box for changing Furigana mode/Japanese font
            $('#upopup').html('');

            $('#upopup').append(
                '<div>' +
                '<a href="http://meta.japanese.stackexchange.com/questions/806/how-should-i-format-my-questions-on-jlu/807#807" ' +
                'style="float: right" target="_blank">Furigana/Japanese extension help »</a>' +
                '<h4>Furigana mode</h4>' +
                '<p><form id="uFuriganaModeForm">' +
                '<input type="radio" name="uFuriganaMode" id="uDisableRubyEngine">' +
                '<label for="uDisableRubyEngine"> don\'t use Furigana/Japanese extensions</label></input><br>' +
                '<input type="radio" name="uFuriganaMode" id="uDisableRuby">' +
                '<label for="uDisableRuby"> don\'t show any Furigana</label></input><br>' +
                '<input type="radio" name="uFuriganaMode" id="uTopAlignRuby">' +
                '<label for="uTopAlignRuby"> top-aligned Furigana (default)</label></input><br>' +
                '<input type="radio" name="uFuriganaMode" id="uBottomAlignRuby">' +
                '<label for="uBottomAlignRuby"> bottom-aligned Furigana</label></input><br>' +
                '<input type="radio" name="uFuriganaMode" id="uMouseOver">' +
                '<label for="uMouseOver"> hide Furigana texts, only show when mousing over kanji</label></input><br>' +
                '</form></p>' +
                '<h4>Furigana tuning</h4>' +
                '<table style="width: 100%"><tr>' +
                '<td style="width: 1px">Size:</td>' +
                '<td>' +
                '<select id="uRubyFontSize" style="width: 100%">' +
                '<option value="big">big Furigana fonts</option>' +
                '<option value="medium">medium-sized Furigana fonts</option>' +
                '<option value="small">small Furigana fonts</option>' +
                '</select>' +
                '</td>' +
                '</tr><tr>' +
                '<td style="width: 1px">Lightness:</td>' +
                '<td>' +
                '<select id="uRubyFontLightness" style="width: 100%">' +
                '<option value="heavy">heavy (dark) Furigana</option>' +
                '<option value="medium">moderate lightness Furigana</option>' +
                '<option value="light">light (unobtrusive) Furigana</option>' +
                '</select>' +
                '</td>' +
                '</tr><tr>' +
                '<td style="width: 1px">Width&nbsp;adjust:&nbsp;</td>' +
                '<td>' +
                '<select id="uRubyFontShrink" style="width: 100%">' +
                '<option value=\'noshrink\'>don\'t shrink Furigana to fit text</option>' +
                '<option value="low">shrink to fit text a little</option>' +
                '<option value="medium">shrink to fit text in moderation</option>' +
                '<option value="high">shrink to fit text a lot</option>' +
                '</select>' +
                '</td>' +
                '</tr><tr>' +
                '<td style="width: 1px">Popups:&nbsp;</td>' +
                '<td>' +
                '<select id="uRubyPopups" style="width: 100%">' +
                '<option value=\'nopopups\'>don\'t show popups on Furigana</option>' +
                '<option value="popups">show popups on Furigana</option>' +
                '</select>' +
                '</td>' +
                '</tr></table>' +
                '<h4>Japanese font</h4>' +
                '<p><select id="uJFontSelect" style="width: 100%"></select></p>' +
                '<input type="button" id="usave" value="save and reload"/> ' +
                '<input type="button" onclick="$(\'#upopup\').hide()" value="close"/>' +
                '</div>'
            ).find('div').css(
                { 'color': '#000', 'textAlign': 'left', 'lineHeight': '1.9em' }
            ).find('a').css(
                { 'color': 'blue', 'margin': 0 }
            );


            $.each(['(automatic)'].concat(this.jaFonts), function () {
                var o = document.createElement('option');
                o.value = this;
                o.innerHTML = this;
                $('#uJFontSelect').append(o);
            }); // restore previous settings/register save settings event
            this.loadSettings();
            $('#usave').click($.proxy(this.saveSettings, this));
        },

        loadSettings: function () {
            // Load which mode (e.g. whether to use Furigana or popup on mouseover)
            var allowedModes = $('input[name=uFuriganaMode]').map(function () {
                return this.id;
            });
            this.mode = this.getStorageKey('uFuriganaMode', allowedModes, 'uTopAlignRuby');
            this.font = this.getStorageKey('uJapaneseFont', this.jaFonts, '(automatic)');
            this.fontSize = this.getStorageKey('uRubyFontSize', ['big', 'small', 'medium'], 'medium');
            this.fontLightness = this.getStorageKey('uRubyFontLightness', ['heavy', 'medium', 'light'], 'heavy');
            this.fontShrink = this.getStorageKey('uRubyFontShrink', ['low', 'medium', 'high', 'noshrink'], 'medium');
            this.rubyPopups = this.getStorageKey('uRubyPopups', ['nopopups', 'popups', 'nofade'], 'popups');

            $('#' + this.mode).prop('checked', true);
            $('#uJFontSelect').val(this.font);

            $('#uRubyFontSize').val(this.fontSize);
            $('#uRubyFontLightness').val(this.fontLightness);
            $('#uRubyFontShrink').val(this.fontShrink);
            $('#uRubyPopups').val(this.rubyPopups);
        },

        saveSettings: function () {
            try {
                localStorage['uFuriganaMode' + DEBUG] = $('input[name=uFuriganaMode]:checked', '#uFuriganaModeForm').attr('id');
                localStorage['uJapaneseFont' + DEBUG] = $('#uJFontSelect').val();
                localStorage['uRubyFontSize' + DEBUG] = $('#uRubyFontSize').val();
                localStorage['uRubyFontLightness' + DEBUG] = $('#uRubyFontLightness').val();
                localStorage['uRubyFontShrink' + DEBUG] = $('#uRubyFontShrink').val();
                localStorage['uRubyPopups' + DEBUG] = $('#uRubyPopups').val();
                location.reload();
            } catch (e) {
                alert('Options can only be changed when localStorage is available. Please check your browser settings.');
            };
        },

        getStorageKey: function (key, allowedValues, defolt) {
            try {
                var value = localStorage[key + DEBUG];
                return ($.inArray(value, allowedValues) !== -1) ? value : defolt;
            } catch (e) {
                return defolt;
            }
        },

        // Editor help for at http://japanese.stackexchange.com/questions/ask etc

        addEditHelp: function () {



            if (isJLSE) {
                // Add to the editor help but only for the Japanese stack
                // exchange, as it probably isn't as relevant for anime.se

                $('<p><span class="dingus">►</span> Furigana ' +
                    '<code class="noFurigana">感じる【かんじる】</code> ' +
                    'or <code class="noFurigana">感じる{かんじる}</code> ' +
                    'or <code class="noFurigana">[飛び越える]{とびこえる}</code></p>').insertBefore('#how-to-format p.ar');

                $('<p><span class="dingus">►</span> pitch accents ' +
                    '<code class="noFurigana">ありがとう【LHLLL】</code> ' +
                    'or <code class="noFurigana">ありがとう{LHLLL}</code></p>').insertBefore('#how-to-format p.ar');

                /*$('<p><span class="dingus">►</span> IPA text ' +
                    '<code class="noFurigana">[[...]]</code> ' +
                    'or <code class="noFurigana">//...//</code> ' +
                    'or <code class="noFurigana">[/.../]</code></p>').insertBefore("#how-to-format p.ar");*/


                $('<p><span class="dingus">►</span> language ' +
                    '<code class="noFurigana">{{zh-CN:中文}}</p>').insertBefore('#how-to-format p.ar');
            } else {
                // Add basic, simplified editor help, including romaji, for anime/
                // manga SE, as the audience there is very different+the extensions
                // probably aren't useful there as often

                $('<p><span class="dingus">►</span> Furigana ' +
                    '<code class="noFurigana">感じる【かんじる】</code> or <code class="noFurigana">感じる{かんじる}</code> ' +
                    'or <code class="noFurigana">[感じる]{kanjiru}</code></p>').insertBefore('#how-to-format p.ar');
            }

            $('<p class="ar"><a target="_edithelp" ' +
                'href="http://meta.japanese.stackexchange.com/questions/806/how-should-i-format-my-questions-on-jlu/807#807">' +
                'Furigana/Japanese extension help »</a></p>').appendTo('#how-to-format');

        },

        // Make Japanese display with Japanese fonts

        jaFonts: [
            'IPAGothic', 'IPAゴシック',
            'TakaoGothic',
            'VL Gothic', 'VLゴシック',
            'UmePlus Gothic',
            'Ume Gothic', '梅ゴシック',
            'MotoyaLCedar',
            'MigMix 2M',
            'Migu 2M',
            'Hiragino Kaku Gothic Pro', 'ヒラギノ角ゴ Pro W3',
            'HiraKakuProN-W3', 'ヒラギノ角ゴ ProN W3',
            'Osaka Mono',
            'Osaka',
            'MS Gothic', 'ＭＳ ゴシック',

            //'Meiryo UI',
            'Meiryo', 'メイリオ',

            //'Sazanami Gothic', 'さざなみゴシック',
            'monospace'
        ],


        fontsToCSS: function (fonts) {
            var userPref = this.font == '(automatic)' ? [] : [this.font];

            return $.map(userPref.concat(this.jaFonts), function (font) {
                return ruby.escapeCSS(font);
            }).join(',');
        },


        escapeCSS: function (font) {
            if (font == 'monospace') {
                return 'monospace';
            }
            return '"' + font.replace(/"/g, '\\"') + '"';
        },


        makeJaFonts: function (inElm) {



            this.makeIPAFonts(inElm);


            // Make Japanese use Japanese fonts
            textNodeFilter(furiganaElms, inElm, function () {

                if ($(this.parentNode).hasClass('ja-text') || !this.data.match(jaRegExp)) {
                    return;
                }

                function onReplace(x) {
                    // lang attributes currently seem to be necessary
                    // for Chrome OS to display Japanese as monospace
                    // https://code.google.com/p/chromium/issues/detail?id=339317
                    return '<span xml:lang="ja" lang="ja" class="ja-text">' + escapeHtml(x) + '</span>';
                }

                if (this.parentNode.childNodes.length == 1 && !String(this.data).replace(jaRegExp, '')) {
                    // If an element only has Japanese text, add the Japanese class to it
                    ruby.makeJaFont(this.parentNode);
                } else if (!this.parentNode.lang && !$(this.parentNode).hasClass('IPA')) {
                    // Otherwise, create a new element with the Japanese ranges
                    var replaceWith = escapeReplace(this, jaRegExp, this.data, onReplace);
                    $(this).replaceWith(replaceWith);
                }
            });

            $('pre:not(.ja-text):not(.noFurigana),code:not(.ja-text):not(.noFurigana)', inElm).each(function () {
                if ($(this).text().match(jaRegExp)) {
                    // Only make pre/code use a Japanese font if they have Japanese text
                    // so that Latin linguistic explanations/English qa on Anime.SE don't
                    // suffer readability-wise
                    ruby.makeJaFont(this);
                } else {
                    $(this).addClass('noFurigana');
                }
            });
        },

        makeJaFont: function (e) {
            if (e.lang) {
                return;
            } else if ($(e).hasClass('IPA')) {
                return;
            }

            e['xml:lang'] = 'ja';
            e.lang = 'ja';
            $(e).addClass('ja-text');
        },

        makeIPAFonts: function (inElm) {
            // Make IPA use fonts which can display IPA

            textNodeFilter(furiganaElms, inElm, function () {














                if ($(this.parentNode).hasClass('IPA') || !this.data.match(ipaRegExp)) {
                    return;
                }
                var that = this;


                function onReplace(a, langCode, langText, pad, pat1, pat2, pat3) {
                    if (pat1) {
                        return '<span class="IPA">[' + escapeHtml(pat1) + ']</span>';
                    } else if (pat2) {
                        return '<span class="IPA">/' + escapeHtml(pat2) + '/</span>';
                    } else if (pat3) {
                        return '<span class="IPA">' + escapeHtml(pat3) + '</span>';
                    } else if (langCode || langText) {
                        if (langCode && langText) {
                            return '<span lang="' + langCode + '">' + escapeHtml(langText) + '</span>';


                        }
                        return '';
                    } else if (pad && ruby.mode in { 'uTopAlignRuby': 0, 'uBottomAlignRuby': 0 }) {
                        var el = that.parentNode;
                        console.log(el);


                        while (true) {
                            if (!el || el == document.body) {

                                break;
                            } else if ($(el).css('display') == 'block') {
                                // Find the nearest block-level element, and
                                // make it the tall ("padded") line-height

                                // This is preferable at e.g.
                                // http://japanese.stackexchange.com/questions/25549
                                // to prevent disruption amongst a sea of Japanese text
                                $(el).addClass('lh');





                                //console.log(el)
                                break;
                            }
                            el = el.parentNode;
                            //alert(el);
                        }

                    }
                    return '';
                }

                var replaceWith = escapeReplace(this, ipaRegExp, this.data, onReplace);
                $(this).replaceWith(replaceWith);

            });
        },


        resizeLoop: function () {




            setInterval(function () {






                ruby.resizeCheck();
            }, 300);
        },


        width: -1,
        height: -1,

        resizeCheck: function () {
            // Only do a relayout if window size changed
            var $window = $(window);

            if ((this.width != $window.width()) || (this.height != $window.height())) {
                this.width = $window.width();
                this.height = $window.height();

                //console.log(this.width + ' ' + this.height);

                this.highlightFurigana(null, true);

                /*setTimeout($.proxy(function() {
                    this.highlightFurigana(null, true);
                }, this), 0);*/
            }
        },


        resizeText: function (inElm) {
            // Some mobile browsers based on WebKit/Blink (e.g. Android Chrome)
            // adjust the text size, but don't adjust the size of ruby.


            if (!(/\bMobile\b|\bAndroid\b|\biPhone\b|\biPad\b/.test(navigator.userAgent))) {
                // Problems can happen on e.g. Firefox/Windows with Meiryo
                // if used on the desktop, so only enable for Mobile.

                return;
            }


            function getFontSize(e) {
                // Reduce rounding issues with font-size
                // if font-size returned as a px value
                //
                // Still has issues with Meiryo/Firefox on Windows(!)
                // e.g. Meiryo text (also incorrectly) computed as 19px font-size from
                // textHeight will become 25px computed font-size if "font-size: 19px"
                // is set

                //console.log(e.css('fontSize'))

                if (e.css('fontSize').indexOf('px') != -1) {
                    return parseFloat(e.css('fontSize'));
                }
                return e.offsetHeight;
            }


            (inElm ? $('ruby', inElm) : $('ruby')).each(function () {
                $('<span id="measureText" class="ja-text" lang="ja" xml:lang="ja" style="font-size: 1em !important; line-height: 1em !important;">あ</span>').insertBefore($(this));
                $(this).css('fontSize', $(this.parentNode).css('fontSize'));

                var measureText = $('#measureText'),
                    ruby = $(this).find('rb, span.rb'),
                    textHeight = getFontSize(measureText),


                    rubyHeight = getFontSize(ruby);

                //measureText[0].id = '';
                measureText.remove();

                if (rubyHeight < (textHeight * 1.4)) {
                    // Ruby text should be similar to the
                    // surrounding text, so assume the height
                    // is incorrect and update with a px value.
                    $(this).css('fontSize', textHeight + 'px');
                }
            });


        },

        // Ruby (Furigana) and Japanese font CSS

        addStyles: function () {

            var bottomAlign = ruby.mode == 'uBottomAlignRuby';


            var alignCSS = bottomAlign ?
                'rt,ruby,rb,span.rt,span.rb{text-align:center; ruby-align:center; ruby-position:under; -webkit-ruby-position: after;}' :
                'rt,ruby,rb,span.rt,span.rb{text-align:center; ruby-align:center; ruby-position:over; -webkit-ruby-position: before;}';


            var fontSize = {
                big: '0.9em',
                medium: '0.75em',
                small: '0.6em'
            }[this.fontSize];

            var padding = {
                big: 1.25,
                medium: 0.95,
                small: 0.83
            }[this.fontSize];

            var rtPos = bottomAlign ? ('bottom: 0;') : ('top: 0;'),
                rubyPadding = bottomAlign ? ('padding-bottom: ' + padding + 'em;') : ('padding-top: ' + padding + 'em;'),

                lhLineHeight = bottomAlign ? ((padding + 0.2) + 1.0 + 'em;') : ((padding + 0.2) + 1.0 + 'em;'),
                lhPos = bottomAlign ? ('bottom: -1.15em;') : ('top: -1.15em;'),

                borderColor = bottomAlign ? 'border-bottom-color: rgba(0, 0, 0, 0);' : 'border-top-color: rgba(0, 0, 0, 0);';


            this.addCSS(
                'ruby{' +
                'display:inline-block; text-indent:0; white-space:nowrap;' +
                'line-height:1em; position:relative; vertical-align:baseline;' +
                'margin:-1px; border: 1px solid transparent;}' +
                'ruby:before, ruby:after {' +
                // Suggest word wrap before/after <ruby> tags
                'content: "\\00200B"}' +
                'rb,span.rb{' +
                'display:inline-block; line-height:1em; height:1em; font-size:1em; border:none;' +
                'margin:0; padding:0; white-space:nowrap; ' + rubyPadding + '}' +
                'rt,span.rt{' +
                'position:absolute; display:block; font-size:' + fontSize + '; line-height:1.3em; height:1.3em;' +
                'white-space:nowrap; border:none; margin:0; padding:0; ' + rtPos + '}' +

                // "padded" line-height to make sure text at e,g,
                // http://japanese.stackexchange.com/questions/25549
                // isn't too crowded. Applied in "makeIPAFonts" above

                // I'm afraid this is not going to be fool-proof in some parent-child element relationships
                // and may have rendering issues, but I'm not sure I can do much about this.
                // {{pad}} should probably be used sparingly!
                '.lh, .lh>span, .lh>code, .lh>li, .lh>ul>li, .lh>ol>li, .lh>dl>dd, .lh>dl>dt, .lh>dt, .lh>dd, ' +
                '.lh>a, .lh>b, .lh>i, .lh>em, .lh>s, .lh>strong, .lh>del, .lh>kbd {line-height: ' + lhLineHeight + ' !important;}' +
                '.lh rb,.lh span.rb{padding: 0;}' +
                '.lh rt,.lh span.rt{' + lhPos + '}' +
                alignCSS
            );

            this.addCSS(
                //':not(a) ruby:hover rt {color: black !important; text-shadow: none !important;}'+
                'span.hiddenruby.hover, span.hiddenruby-rp.hover, ruby.popups.hover{' +
                'border:1px solid #ccc; border-radius:0 0 2px 2px; background:white;' +
                'transition: background 200ms;' + borderColor + '}' +
                'ruby.popups.hover rt, ruby.popups.hover span.rt{' +
                'visibility: hidden;}' +

                // for "popups" mode only
                'span.hiddenruby, span.hiddenruby-rp{' +
                'border: 1px solid transparent; border-bottom:2px dotted rgba(30, 50, 30, 0.25); ' +
                'cursor:default; white-space:nowrap; margin:-1px;}' +
                'span.hiddenruby.hover, span.hiddenruby-rp.hover{' +
                'border-bottom-width: 2px !important;}' +

                // the CSS for the popups themselves
                '#upop .line,.upop .line{' +
                'height:1px; overflow:hidden; position:absolute; bottom:-1px; background: white;}' +
                '#upop,.upop{' +
                'position:relative; padding:3px 5px; font-size:1.32em; text-align:center;' +
                'border-radius:3px; border:1px solid #ccc; white-space:nowrap; cursor:default; color: rgba(0, 0, 0, 0.0);}' +
                '#upop.transition,.upop.transition {' +
                'background: white; transition: background 200ms; color: black;}' +

                // Japanese tones
                'span.tone-h{border-top:1px solid red;}' +
                'span.tone-l-change{border:solid red; border-width:0 0 1px 1px;}' +
                'span.tone-l{border-bottom:1px solid red;}' +
                'span.tone-h-change{border:solid red; border-width:1px 0 0 1px;}' +


                // font-related
                (this.font == '(automatic)' ? ''
                    : '.ja-text{font-family: ' + this.escapeCSS(this.font) + ' !important;}') +
                'code .ja-text, pre .ja-text, code.ja-text, pre.ja-text {' +
                'font-family: ' + this.fontsToCSS(this.jaFonts) + ' !important;}' + // font-size: 14px;
                '.IPA{font-family: Andika, Doulos SIL, Gentium, ' +
                'GentiumAlt, Segoe UI, DejaVu Sans, Bitstream Vera Sans, TITUS Cyberbit Basic, ' +
                'Bitstream Cyberbit,' +
                'Arial Unicode MS, Lucida Sans Unicode, Code2000,' +
                'Hiragino Kaku Gothic Pro, Matrix Unicode, Chrysanthi Unicode;}'
            );
        },

        // Main loop which is run periodically to scan for changes

        loop: function () {

            if (isJLSE) {
                $('.draft-saved').each(function () {
                    // Add "furigana help" links
                    if (!this.editHelpAdded) {
                        $('<div title="Furigana Editing Help" style="float: left; padding-top: 6px; padding-right: 17px; font-weight: bold">' +
                            '<a href="http://meta.japanese.stackexchange.com/questions/806/how-should-i-format-my-questions-on-japanese-language-se" target="_blank">' +
                            'Furigana/Japanese extension help »' +
                            '</a></div>').insertBefore(
                            this
                        );

                        this.editHelpAdded = true;
                    }
                });
            }

            $('.post-text, .question-hyperlink, .module sidebar-related, ' +
                '.excerpt, .answer-hyperlink, .summary, .question-summary, ' +
                '.answer-summary, .question-title, .answer-title, .top-detail, ' +
                '.wmd-preview, #question-header, .comment-text, .comment-body, ' +
                '.single-badge-summary, .lines, .async-load, .history-table').each(function () {
                    // Only process elements once

                    if (this.firstChild && !this.firstChild.furiganaDone) {
                        ruby._loop(this);
                    }

                    if (this.firstChild && !$(this).hasClass('wmd-preview')) {
                        this.firstChild.furiganaDone = true;
                    }
                });

            $('input[type=text], textarea').each(function () {
                // Use Japanese fonts for textareas/text inputs
                // This is needed here, as textareas are often created
                // after the page is loaded in SE's JavaScript
                if (!this.jaFont) {
                    this.jaFont = true;
                    ruby.makeJaFont(this);
                }
            });
        },

        _loop: function (inElm) {
            this.translationTags(inElm);
            this.makeJaFonts(inElm);


            function isHotNetwork(e) {
                // prevent Furigana displaying in e.g. math 
                // stack exchange links in "hot network" links
                try {
                    return $.trim(e.parentNode.parentNode.parentNode.parentNode.parentNode.id) == 'hot-network-questions';
                } catch (a) {
                }
                return false;
            }


            // a.question-hyperlink h2 is for hyperlinks on mobile.
            // div.excerpt is for browsing through question summaries.


            textNodeFilter(furiganaElms, inElm, function () {

                if (!(this.nodeType == 3 &&
                    !isHotNetwork(this) &&
                    this.data && this.data.match(replaces))) {
                    return;
                }


                for (var i = 0; i < cache.length; i++) {
                    if (cache[i] == this && true) {
                        return;
                    }
                }


                var changed_data = escapeReplace(this, replaces, this.data, function ($0, $1, $2, $3, $4, $5, $6, $7, $8) {
                    var kanji = $2 || $5 || $7,
                        furigana = $3 || $6 || $8,
                        honorific = $1 || $4 || '',
                        isPitchAccent = furigana.match(/^\s*[hlHL]+\s*$/);

                    if (kanji.length > 30 || furigana.length > 50) {
                        // Don't allow really long Furigana, as it can upset display
                        return '[' + escapeHtml(honorific || '') +
                            escapeHtml(kanji || '') + ']' +
                            '【' + escapeHtml(furigana || '') + '】';
                    }






                    // Support for going '﹅﹅' instead of having to use
                    // '﹅・﹅' every time for emphasis characters
                    var furiganas = furigana.split(reKanjiSplit),
                        isEmphasis = false,
                        emphChars;

                    for (var i = 0; i < emphasisChars.length; i++) {
                        emphChars = Array(kanji.length + 1).join(emphasisChars.charAt(i));
                        //console.log(furiganas.join('')+' '+furigana+' '+kanji)

                        if (furiganas.join('') == emphChars || furigana == emphChars) {
                            isEmphasis = true;
                            break;
                        }
                    }




                    if (!isPitchAccent && !isEmphasis) {
                        // Only allow Furigana for emphasis characters/
                        // LH pitch accents if in popups/disable ruby mode.

                        if (ruby.mode == 'uMouseOver') {
                            return '<span class="hiddenruby-rp" title="' +
                                escapeHtml(furigana) +
                                '">' + escapeHtml(kanji) + '</span>';
                        } else if (ruby.mode == 'uDisableRuby' && !isPitchAccent && !isEmphasis) {
                            return escapeHtml(kanji);
                        }
                    }


                    var kanjis = kanji.split('');
                    furiganas = isEmphasis ? emphChars.split('') : furiganas;
                    //console.log(kanjis+' '+furiganas);


                    if (kanjis.length == furiganas.length) {
                        return $.map(kanjis, function (k, i) {
                            if (furiganas[i] && k != furiganas[i]) {
                                return ruby.rubyize((!i) ? honorific : '', k, furiganas[i]);
                            } else {
                                // Workaround for http://japanese.stackexchange.com/questions/18857/
                                // Makes it so that e.g. 目覚め{め・ざ・} works
                                return escapeHtml(k);
                            }
                        }).join('');
                    }

                    return ruby.rubyize(honorific, kanji, furigana);
                });

                if (this.data != changed_data) {
                    var parent = this.parentNode;
                    $(this).replaceWith(changed_data);

                    // performance warning
                    ruby.highlightFurigana(parent);
                }
                cache.push(this);
            });

            if (this.mode == 'uMouseOver') {
                this.replaceTitleAttrs();
            }
        },


        highlightFurigana: function (inElm, force) {
            var fontLightness = {
                heavy: 0,
                medium: 0.2,
                light: 0.4
            }[this.fontLightness];

            $('ruby > span.rt,ruby > rt', inElm).each(function () {
                if (!this.highlighted) {
                    this.highlighted = true;

                    $(this).css('text-shadow', '0 0 1px rgba(0, 255, 0, 0.12');
                    $(this).css('color', shadeBlend(fontLightness, $(this).css('color')));
                }
            });

            ruby.resizeText(inElm);

            var fontReflow = [];

            $('ruby > span.rt,ruby > rt', inElm).each(function () {
                if (!this.resized || force) {
                    var rb = $('> span.rb, > rb', this.parentNode)[0];
                    this.resized = true;

                    var rtX = this.offsetWidth, minX = this.offsetWidth;

                    if (ruby.fontShrink != 'noshrink') {
                        // When using CSS transforms to stretch the ruby, the reported
                        // and actual widths are different and need to be adjusted.
                        this.parentNode.style.minWidth = 0;
                        minX = ruby.shrinkFurigana(this);
                    }

                    var contX = rb.offsetWidth;
                    this.parentNode.style.minWidth = minX + 'px';

                    if (contX > rtX) {
                        this.style.left = (contX / 2.0) - (rtX / 2.0) + 'px';
                    } else {
                        this.style.left = 0;
                    }

                    if (this.parentNode.title) {
                        if (
                            ruby.rubyPopups != 'nopopups' &&
                            (emphasisChars.indexOf($.trim(this.parentNode.title)) == -1)) {

                            ruby.bindPopup(this.parentNode, this.parentNode.title);
                        }
                        this.parentNode.title = '';
                    }
                }


                var elm = this.parentNode.parentNode;
                if (fontReflow.indexOf(elm) == -1) {
                    fontReflow.push(elm);
                }
            });


            // Android Chrome font reflow hack. This is here due to rendering
            // bugs in Chrome Android (and possibly other browsers/OSes)

            // I've tried various other things, some at
            // http://stackoverflow.com/questions/3485365:
            // * set z-index/padding/display: none/scale/translateZ/line-height/font-size,
            //   get offset* to force relayout, reset to original
            // * remove element, get offset*, re-add
            // * add and remove a <style> element to the document
            //
            // but only set text color (and a lesser extent font-size),
            // get offset*, reset seems to work reasonably consistently
            //
            // **still has issues in tandem with {{pad}}ed <code> tags!**

            $.each(fontReflow, function (index, elm) {



                elm.style.color = '#222222';
            });


            $.each(fontReflow, function (index, elm) {
                // Force a redraw, in a separate loop to hopefully
                // allow the browser to do a batch redraw
                elm.offsetTop;
                elm.offsetWidth;
                elm.offsetHeight;

                elm.style.color = '';
            });
        },


        _setCSS: function (s, key, value) {
            var tKey = key.charAt(0).toUpperCase() + key.slice(1);
            s['webkit' + tKey] = s['Moz' + tKey] =
                s['ms' + tKey] = s['O' + tKey] = s[key] = value;
        },

        shrinkFurigana: function (rt) {






            this._setCSS(rt.style, 'transform', 'none');


            var ruby = rt.parentNode,
                rb = $('> rb,> span.rb', ruby)[0];

            var rtX = rt.offsetWidth;
            ruby.removeChild(rt);
            var rbX = rb.offsetWidth;

            var minStretch = {
                'low': 0.75,
                'medium': 0.67,
                'high': 0.5
            }[this.fontShrink];


            var desiredX = Math.max(rtX * minStretch, parseFloat(rbX));
            if (desiredX > rtX) {
                desiredX = rtX;
            }

            var xStretch = desiredX / rtX,
                s = rt.style;


            this._setCSS(s, 'transform', 'scale(' + xStretch + ',1)');
            this._setCSS(s, 'transformOrigin', '1% 50%');

            // Setting a specific width seems to break Android Chrome...
            //s.width = desiredX+'px';
            s.whiteSpace = 'nowrap';

            ruby.appendChild(rt);
            return rt.offsetWidth * minStretch;
        },

        // Add ruby/pitch tones

        rubyize: function (honorific, kanji, furigana) {
            var n = furigana.match(/^\s*([hlHL]+)\s*$/);

            if (n) {
                // add pitch tones if HL format
                var o = '',
                    prev = null,
                    n = n[1].toLowerCase();

                kanji = honorific + kanji;

                for (var i = 0; i < Math.min(n.length, kanji.length) ; i++) {
                    var escChar = escapeHtml(kanji.charAt(i));

                    if (n.charAt(i) == 'h') {
                        if (prev === 'l') {
                            o += '<span class="tone-h-change">' + escChar + '</span>';
                        } else {
                            o += '<span class="tone-h">' + escChar + '</span>';
                        };
                    } else if (n.charAt(i) == 'l') {
                        if (prev === 'h') {
                            o += '<span class="tone-l-change">' + escChar + '</span>';
                        } else {
                            o += '<span class="tone-l">' + escChar + '</span>';
                        };
                    };

                    prev = n.charAt(i);
                };

                o += escapeHtml(kanji.slice(i, kanji.length));

                return o;
            } else {
                // otherwise add ruby/Furigana
                var that = this;

                var getRuby = function (kanji, furigana) {
                    var popups = that.rubyPopups ? ' popups' : '';

                    if (navigator.userAgent.indexOf('AppleWebKit') != -1) {
                        // HACK: Chrome doesn't seem to allow anything other than position: static on rt elements
                        return '<ruby title="' + escapeHtml(furigana) + '" class="ruby-rp' + popups + '"><span class="rb">' + escapeHtml(kanji) + '</span><span class="rt">' + escapeHtml(furigana) + '</span></ruby>';
                    } else {
                        return '<ruby title="' + escapeHtml(furigana) + '" class="ruby-rp' + popups + '"><rb>' + escapeHtml(kanji) + '</rb><rt>' + escapeHtml(furigana) + '</rt></ruby>';
                    }
                };
                var prepend = '';
                if (honorific == furigana.charAt(0)) {
                    if (kanji.match(/^[^ぁ-ヾ].*/)) {
                        // If there's an お or ご before Kanji and
                        // the Furigana starts with the same,
                        // assume it's an honorific.
                        prepend = honorific;
                        furigana = furigana.slice(1);
                    } else {
                        kanji = honorific + kanji;
                    }
                } else if (honorific) {
                    prepend = honorific;
                }


                var okurigana = this.getOkuriganaRegExp(kanji),
                    match;

                if (okurigana) {
                    var regExp = okurigana[0],
                        kanjis = okurigana[1];
                    match = furigana.match(regExp);
                }

                if (match) {
                    // Okurigana found, so don't display Furigana on top of it
                    var ruby = prepend;
                    for (var i = 1; i < match.length; i += 2) {
                        var kanji = kanjis[(i - 1) / 2],
                            furigana = match[i],
                            okurigana = match[i + 1];

                        ruby += getRuby(kanji, furigana) + escapeHtml(okurigana);
                    }
                    return ruby;
                } else {
                    return prepend + getRuby(kanji, furigana);
                }
            };
        },

        getOkuriganaRegExp: function (kanji) {
            var outRegExp = '',
                kanjis = [];

            var onReplace = function (a, kanji, okurigana) {
                kanjis.push(kanji);
                outRegExp += '(.+)(' + okurigana + ')';
                return '';
            };
            var shouldBeEmpty = kanji.replace(/([^ぁ-ヾ]+)([ぁ-ヾ]+)/g, onReplace);

            if (!shouldBeEmpty && outRegExp) {
                return [new RegExp('^' + outRegExp + '$'), kanjis];
            }
        },


        // "hide furigana texts, only show when mousing over kanji" mode

        replaceTitleAttrs: function () {
            // add faster popup windows as "title=" takes some time to appear
            // "title=" also usually isn't usable on tablets
            $('.hiddenruby-rp').each(function (e) {
                // go through the "rp", aka "reprocess" classes
                $(this).removeClass('hiddenruby-rp').addClass('hiddenruby');
                var title = String(this.title);

                this.title = '';


                ruby.bindPopup(this, title);
            });
        },


        bindPopup: function (elm, title) {
            var upop;
            elm.style.cursor = 'default';


            function mouseout(e) {
                if (!upop) {
                    return;
                } else if (e.relatedTarget == upop[0] ||
                    e.relatedTarget == $('> div.line', upop[0])[0] ||
                    e.relatedTarget == $('> span.rt,> rt', elm)[0] ||
                    e.relatedTarget == $('> span.rb,> rb', elm)[0] ||
                    e.relatedTarget == elm) {

                    // Don't hide the popup if moving from one element
                    // to another inside the popup itself
                    return;
                }


                $(elm).removeClass('hover');
                upop.removeClass('transition');
                upop.remove();
                upop = null;
            }


            $(elm).mouseover(function (e) {
                if (window.getSelection && window.getSelection().toString()) {
                    return;
                }

                if (upop) {
                    return;
                }

                $(document.body).append('<div id="upop" class="upop ja-text"><div class="line"></div>' + escapeHtml(title) + '</div>');
                upop = $('#upop');
                upop.attr('id', '');
                upop[0].style.minWidth = elm.offsetWidth - 6 + 'px';
                upop.addClass('transition');

                $(elm).addClass('hover');

                ruby.makeJaFont(upop[0]);
                upop.css('position', 'absolute');
                ruby.updateUPopPos(upop, e, elm);
                upop.mouseout(mouseout);


                var line = $('div.line', upop[0])[0];
                line.style.width = elm.offsetWidth - 2 + 'px';
                line.style.left = (upop[0].offsetWidth / 2.0) - ((elm.offsetWidth) / 2.0) + 'px';

                if (ruby.mode == 'uBottomAlignRuby') {
                    line.style.bottom = 'auto';
                    line.style.top = '-1px';
                    // Add some extra padding to compensate for the mouse cursor
                    upop[0].style.paddingTop = '18px';
                } else {
                    line.style.bottom = '-1px';
                    line.style.top = 'auto';
                    upop[0].style.paddingTop = '3px';
                }

            }).mouseout(mouseout);
        },

        updateUPopPos: function (upop, e, elm) {
            var popTop = 0;

            if (elm.tagName.toLowerCase() == 'ruby') {
                var rt = $('> span.rt,> rt', elm)[0],
                    rb = $('> span.rb,> rb', elm)[0];


                function getPadding(i) {
                    return parseInt(String($(rb).css('padding' + i)).toLowerCase().replace('px', ''));
                }


                if (this.mode == 'uTopAlignRuby') {
                    popTop = this.offset(elm).top - upop[0].offsetHeight;
                    popTop += getPadding('Top'); //rt.offsetHeight-2;
                } else {
                    popTop = this.offset(elm).top + elm.offsetHeight;
                    popTop -= getPadding('Bottom'); //rt.offsetHeight;
                }
            } else {
                popTop = this.offset(elm).top - upop[0].offsetHeight + 1;
            }


            var setTo = {
                top: popTop,
                left: this.offset(elm).left - (upop[0].offsetWidth / 2.0) + (elm.offsetWidth / 2.0),
                right: 'auto',
                maxWidth: $(window).width()
            };


            if ((setTo.left + 12 + upop.width()) > $(window).width()) {
                // Especially in the mobile website,
                // make sure popup isn't offscreen
                setTo.left = 'auto';
                setTo.right = 0;

            } else if ((setTo.left - 12) < 0) {
                setTo.left = 12;
            }

            upop.css(setTo);
        },

        offset: function (elm) {
            // This is needed to fix the positioning for the Furigana in the sidebar
            // at e.g. http://japanese.stackexchange.com/questions/30134

            // It's not enough to use jQuery, as its calculations go out when text
            // is scaled on Android/Chrome

            var x = 0,
                y = 0,
                offsetElm = elm;

            while (true) {
                if (!elm || elm == document.body) {
                    break;
                }

                x += elm.offsetLeft || 0;
                y += elm.offsetTop || 0;

                elm = elm.offsetParent;
            }


            // This is to fix when there's scrollbars in <pre> elements
            // due to content overflowing
            elm = offsetElm;

            while (true) {
                if (!elm || elm == document.body) {
                    break;
                }

                x -= elm.scrollLeft || 0;
                y -= elm.scrollTop || 0;

                elm = elm.parentNode;
            }


            return { left: x, top: y };
        },


        // translation extensions

        userElmId: 0,

        translationTags: function (inElm) {
            if (window.opts && opts['isMobile']) {
                // I think it's best not to enable translations
                // on mobile for now, but might later
                return;
            }


            $('div.wmd-preview, div.post-text').each(function () {
                if (!this.firstChild) {
                    return;
                } else if (this.firstChild.langProcessed) {
                    return;
                }


                var thisLang = null,
                    langElms = {},
                    possibleLangs = ['null'];

                $(this).children().each(function () {
                    this.parentNode.removeChild(this);

                    if (this.tagName && this.tagName.toLowerCase() == 'h1') {
                        var langs = {
                            'Japanese': '日本語',
                            '日本語': '日本語',
                            '和訳': '日本語',
                            'English': 'English',
                            '英語': 'English',
                            '英訳': 'English'
                        };
                        if ($.trim(this.innerHTML) in langs) {
                            thisLang = langs[$.trim(this.innerHTML)];
                            possibleLangs.push(thisLang);
                            return;
                        }
                    }

                    langElms[thisLang] = langElms[thisLang] || [];
                    langElms[thisLang].push(this);
                });


                // Add tabs container
                var tabs = $('<div id="tabs" class="trans-tab"></div>')[0];
                this.appendChild(tabs);

                var that = this,
                    numTabs = 0;

                function addTab(lang, elems) {
                    // Create tab items
                    var a = $('<a>' + escapeHtml(lang) + '</a>')[0];
                    tabs.appendChild(a);

                    a.onclick = function () {
                        ruby.changeTransTab(lang);
                    };
                    a.transLang = lang;


                    // Create the element to put the language content in
                    var div = $('<div class="trans-elem"></div>')[0];
                    that.appendChild(div);
                    div.transLang = lang;


                    $.each(elems, function () {
                        div.appendChild(this);
                    });
                    numTabs++;
                }

                var used = {},
                    firstLang = null;
                $.each(possibleLangs, function () {
                    var elms = langElms[this];
                    if (!elms || this in used) {
                        return;
                    }
                    used[this] = true;

                    if (this == 'null' && '日本語' in langElms && !('English' in langElms)) {
                        addTab('English', elms);
                        firstLang = firstLang || 'English';
                    } else if (this == 'null' && 'English' in langElms && !('日本語' in langElms)) {
                        addTab('日本語', elms);
                        firstLang = firstLang || '日本語';
                    } else if (this == 'null') {
                        $.each(elms, function (i) {
                            that.insertBefore(this, that.childNodes[i]);
                        });
                    } else {
                        addTab(this + '', elms);
                        firstLang = firstLang || this + '';
                    }
                });


                if (numTabs) {
                    ruby.changeTransTab(firstLang, this);
                } else {
                    this.removeChild(tabs);
                }

                if (this.firstChild) {
                    this.firstChild.langProcessed = true;
                }
            });
        },

        changeTransTab: function (lang, elm) {
            //var prevScroll = document.scrollTop;

            $('.trans-tab a', elm).each(function () {
                this.className = this.transLang == lang ? 'youarehere' : '';
            });

            $('.trans-elem', elm).each(function () {
                $(this).css('display', this.transLang == lang ? 'block' : 'none');
            });

            //document.scrollTop += document.scrollTop-prevScroll;
            this.resizeText();
        }
    };
    ruby.start();
});

