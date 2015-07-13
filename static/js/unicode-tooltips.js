function add_unicode_tooltip() {
    var element = $(this);
    element.qtip({
        content: function(event, api) {
            return generate_unicode_tooltip_html(element);
        },
        position: {
            my: 'top left',
            at: 'bottom middle',
            adjust: { y: 5 },
            target: element,
            // target: 'mouse'
        },
        style: { classes: 'uni-tooltip', def: false },
        show: { delay: 30 },
        hide: { fixed: true, delay: 100 },
    });
}

function add_annotation_tooltip() {
    var element = $(this);
    element.qtip({
        content: { attr: 'data-annotation' },
        position: {
            my: 'top left',
            at: 'bottom middle',
            target: element,
            adjust: { y: 5 },
        },
        style: { classes: 'an-tooltip', def: false },
        show: { delay: 0 },
        hide: { fixed: true, delay: 100 },
        //hide: false,  -- for debugging
        events: {
            show: function(event, api) { element.addClass('an-hover') },
            hide: function(event, api) { element.removeClass('an-hover') },
        },
    });
}

function generate_unicode_tooltip_html(el) {
    var name = el.attr('data-name')
    var code = el.attr('data-code');
    var chr = el.contents().filter(function() { return this.nodeType == 3 }).text();

    return '<span class="unicharbox"><bdo dir="ltr">' + chr + '</bdo></span>'
        + ' <a href="http://www.fileformat.info/info/unicode/char/' + code + '">' + code + '</a>'
        + ' ' + _encode(name);
}

function _encode(str) {
    return $('<div/>').text(str).html();
}
