function add_unicode_tooltip() {
    var element = $(this);
    element.qtip({
        content: function(event, api) {
            return generate_unicode_tooltip_html(element);
        },
        position: {
            my: 'top left',
            at: 'bottom right',
            target: element,
            // target: 'mouse'
        },
        style: { classes: 'uni-tooltip' },
    });
}

function add_annotation_tooltip() {
    var element = $(this);
    element.qtip({
        content: { attr: 'title' },
        position: {
            my: 'top left',
            at: 'bottom right',
            target: element,
            // target: 'mouse'
        },
        style: { classes: 'an-tooltip' },
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
