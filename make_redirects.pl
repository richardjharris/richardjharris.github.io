#!/usr/bin/perl

# Creates redirects from the old version of my blog to the new one.

use v5.16;
use warnings;
use autodie qw(:io);

my %article_redirects = (
    'viewing-english-and-japanese-subtitles-at-the-same-time.html' => 'viewing-english-and-japanese-subtitles-at-the-same-time',
    'a-fun-gotcha-with-magic.html' => 'fun-gotcha-with-magic-diamond',
    'much-ado-about-unless.html' => 'how-i-use-unless',
    'three-revelations-about-datetime-and-why-simpler-is-sometimes-better.html' => 'three-revelations-about-datetime-and-why-simpler-is-sometimes-better',
    'exposing-git-committer-habits-with-ansiheatmap.html' => 'exposing-git-committer-habits-with-ansi-heatmap',
    'all-sorts-of-things-you-can-get-wrong-in-unicode-and-why.html' => 'all-sorts-of-things-you-can-get-wrong-in-unicode-and-why',
    'unicode-in-five-minutes.html' => 'unicode-in-five-minutes',
);

for my $html (keys %article_redirects) {
    my $new_page = $article_redirects{$html};
    open my $fh, '>', "build/$html";
    print {$fh} <<"EOF"
<!DOCTYPE html>
<meta charset=utf-8>
<title>Redirecting...</title>
<link rel=canonical href="/$new_page/">
<meta http-equiv=refresh content="0; url=/$new_page/">
EOF
}
