Title: A fun gotcha with magic <>
Date: 2013-09-13 10:00
Category: Perl
Tags: perl, pbp, gotcha
Slug: fun-gotcha-with-magic-diamond

Despite liberally sprinkling my shell scripts with `-e`[^eflag] and `-o pipefail`[^pipeflag],
and adding defense with `use autodie;` in Perl scripts, there's a still some logic in
_Perl's core_ that allows an error to slip by unnoticed.

## Problem ##

Consider a typical Perl script with a read loop:

    :::perl
    #!/usr/bin/perl
    use strict;
    use warnings;
    use autodie ':io';

    while (<>) {
        chomp;
        my ($size, $toppings) = split /\t/, $_, 2;
    }

Due to the magic `<>`, the script can be called either as `order-pizza pizzalist`
(where `pizzalist` is a file) or `order-pizza < pizzalist` (via standard input).

The problem occurs when `pizzalist` does *not exist*: Perl will complain:

    Can't open pizzalist: No such file or directory ...

...but the script will continue as if `<>` returned `undef` (exiting the loop)
and terminate with zero exit status! Indicating success, despite the error.

This caused a problem for me when a file went missing and this script suddenly
did nothing, but we didn't pick up on it immediately because the script exited
just fine!

## Solution ##

This is actually documented in the [readline perldoc][] for newer Perl
versions; the workaround is to read the files yourself, but this doesn't
handle standard input. (It also uses two argument [open][^whybad]!)
You'll need to handle standard input (and `-` being used as a placeholder)
specially.

Something like:

    :::perl
    use autodie ':io';

    @ARGV = ('-') if !@ARGV;
    foreach my $arg (@ARGV) {
        my $fh;
        if ($arg eq '-') {
            $fh = \*STDIN;
        }
        else {
            open $fh, '<', $arg;
        }
        while ( ! eof($fh) ) {
            $_ = <$fh>;
            ...
        }
    }

Not quite as simple as `while (<>) { ... }`, huh? :(

[readline perldoc]: http://perldoc.perl.org/functions/readline.html
[open]: http://perldoc.perl.org/functions/open.html
[^eflag]: If a command fails, abort the script rather than chugging onwards.
[^pipeflag]: In a pipeline, if an earlier part of the pipe fails, don't allow the non-zero exit code to be masked by commands later in the pipe that exit successfully. Critical!
[^whybad]: With two argument open, special characters such as `>` and `|` will be interpreted respectively as 'open the file for writing' and 'open a shell with the following command for input/output'. Leading whitespace is trimmed, too. This causes subtle bugs and/or security flaws in your script.
