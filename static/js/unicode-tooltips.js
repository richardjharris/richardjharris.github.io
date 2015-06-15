function add_tooltip() {
    var element = $(this);
    element.simpletip({
        fixed: true,
        offset: [-10,-70],
        onBeforeShow: function() {
            element.removeAttr('title');
            var html = generate_tooltip_html(element);
            this.update(html);
        },
    });
}

function generate_tooltip_html(el) {
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
