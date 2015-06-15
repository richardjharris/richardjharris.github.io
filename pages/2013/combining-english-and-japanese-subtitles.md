Title: Viewing English and Japanese subtitles at the same time
Date: 2013-09-13 12:00
Category: Japanese
Tags: perl

On Linux I don't know of any good media players that'll show multiple
subtitles together, which poses a problem if you want to watch with subs
in both the language you're learning and your native tongue.

Fortunately the <i>un</i>fortunately-named ASS format supports displaying
more than one sub at a time, and we can use that to get a result like this:

![EN/JP subs together](/static/images/enjp-subs.jpg)
{: style='text-align: center' }

## The method ##

In my case, I had a bunch of Japanese subs in .srt format, and English
subs in .ass format. The approach is simple: for each video,

 * Create a new .ass layer called 'Japanese' alongside default.
 * Change the layer alignments to put one at the top, one at the bottom.
 * Parse the .srt to extract subtitle lines and timings.
 * Generate equivalent lines in .ass format, and shove them on the end
   of the existing file, using the new 'Japanese' layer.

.ass is a great format because subs don't have to be ordered by time
or anything. The only snafu is that there are two formats ('v4' and 'v4+')
which have completely different alignment values (e.g. '2' might correspond
to 'bottom left' for one format, but 'top centre' for another). So we also
upgrade any v4 subs to v4+ for sanity reasons.

## The goods ##

Here is an example set of subs for 日本人の知らない日本語 ("Japanese that
Japanese people don't know"):

 * [Download ZIP](/static/downloads/Nihonjin_no_Shiranai_Nihongo_enjp.zip) (263 KB)

## The script ##

Here is the script I wrote; it's pretty specific to one set of subs, but I
may expand it once I have tried a few other shows.

    :::perl
    #!/usr/bin/perl
    use strict;
    use warnings;
    use autodie ':io';
    use utf8;
    use open ':std', ':encoding(UTF-8)';
    use File::Temp;
    use File::Copy qw(move);

    my $JP_SPACE = '　';
    my $JP_STYLE = 'Style:Japanese,Arial,24,&H00FFEEEE,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1\n';

    for my $episode (qw(01 02 03 04 05 06 07 08 09 10 11), '12 finale') {
        my $base = "Nihonjin no Shiranai Nihongo ep$episode (704x396 XviD)";
        convert("$base.ass", "$base.jp.srt", "enjp-$base.ass");
    }

    sub convert {
        my ($ass, $srt, $out) = @_;
        open my $assfh, '<:utf8', $ass;
        open my $srtfh, '<:utf8', $srt;
        my $outfh = File::Temp->new;
        binmode $outfh, ':utf8';

        # Read .ass file and add Japanese style
        while (<$assfh>) {
            if (/^Style:\s*Default/) {
                # Change alignment from middle-bottom to middle-top and adjust border
                s/2,2,2/2,1,8/;
            }
            # Upgrade to v4+ for sanity reasons - alignment numbers different between v4 and v4+
            s/v4\.00(?!\+)/v4.00+/i if /^ScriptType:/i;
            s/V4/V4+/i if /\[V4 Styles\]/i;
            print {$outfh} $_;
            if (/^Style:\s*Default/) {
                print {$outfh} $JP_STYLE;
            }
        }

        # Now add Japanese lines
        while (<$srtfh>) {
            my $num = $_;
            # A byte-order mark? Get out with yez
            $num =~ s/^\x{FEFF}//;
            $num =~ /^\d+\r?\n$/ or die "can't parse '$_'";
            my $timings = <$srtfh>;
            $timings =~ /^(.*?) --> (.*?)\r?\n$/;
            my ($start, $end) = ($1, $2);
            my @lines;
            while (<$srtfh>) {
                s/\r?\n//g;
                last if !$_;
                push @lines, $_;
            }

            my $all = join '\\n', @lines;
            $all =~ s/$JP_SPACE+/$JP_SPACE/g;

            printf {$outfh} "Dialogue: 0,%s,%s,Japanese,,0000,0000,0000,,%s\n",
                _time2ass($start),
                _time2ass($end),
                $all;
        }

        close $outfh;
        move($outfh->filename, $out);
    }

    sub _time2ass {
        my $t = shift;
        $t =~ /^(\d+):(\d+):(\d+),(\d\d)\d*$/ or die "invalid time '$t'";
        my ($h,$m,$s,$ms) = ($1, $2, $3, $4);
        $h = 0+$h; # no leading zeros
        return sprintf '%d:%02d:%02d.%02d', $h, $m, $s, $ms;
    }

## Site note ##

.sub/.idx files are very common; they're a huge pain because the subtitles
are stored as images and require OCR. The best bet there is probably to
hard-code the subs onto the video, then layer the other set over them.
