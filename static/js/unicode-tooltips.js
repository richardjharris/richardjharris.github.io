function add_tooltip(elem) {
    console.log("adding tooltip to", elem.html());
    console.log("title = ", elem.attr('title'));
    elem.tooltipsy({
        content: 'Hello',
//        alignto: 'cursor',
//        offset: [10,10],
//        content: function($el, $tip) {
//            console.log("tooltipsy callback called for", $el);
//            $tip.html(generate_tooltip_html($el));
 //       },
    });
    console.log("added");
}

function generate_tooltip_html(el) {
    var name = el.attr('data-name');
    var code = el.attr('data-code');
    var chr = el.contents().filter(function() { return this.nodeType == 3 }).text();

    console.log("generating tooltip data for " + name + " " + code);

    return '<span class="unicharbox"><bdo dir="ltr">' + chr + '</bdo></span>'
        + ' <a href="http://www.fileformat.info/info/unicode/char/' + code + '">' + code + '</a>'
        + ' ' + _encode(name);
}

function _encode(str) {
    return $('<div/>').text(str).html();
}
