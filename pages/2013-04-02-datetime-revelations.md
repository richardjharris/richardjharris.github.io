Title: Three revelations about DateTime (and why simpler is sometimes better)
Date: 2013-04-02 11:00
Category: Perl
Tags: perl, datetime

[[DateTime::]] is an amazing module, and our go-to module at work for any date
manipulation. It's stable, it handles all the edge cases and it has a nice API.
Even so, there are some cases where going outside the DateTime ecosystem makes
your life a lot simpler, and I'm going to illustrate one of those times.

## The Gap ##

So I was making a simple tool to go through log files which were prefixed
with the current time, like so:

    [2013-04-01 21:03:01 BST] Your mum has exploded!
    [2013-04-01 21:03:02 BST] (CRITICAL) Someone's mum has exploded, aborting

...and identify gaps in the log bigger than _n_ seconds by adding some text:

    [2013-04-01 21:03:01 BST] Trying to order pizza using bitcoins
    [2013-04-01 21:03:05 BST] Waiting for currency to stabilise...
    --- GAP: 12 years and 96 days ---
    [2025-07-03 11:55:21 BST] Timed out

Here's my initial take using DateTime ([full version](https://gist.github.com/richardjharris/5288171)):

    :::perl
    my $span = DateTime::Format::Human::Duration->new;
    my $dtparse = DateTime::Format::Strptime->new(...);

    my $prev;
    while (my $line = <>) {
        $line =~ /^\[ (.*?) \]/x or next;
        my $ts = $dtparse->parse_datetime($1);
        if ($ts) {
            if ($prev) {
                my $delta = $ts - $prev;
                if ($delta->in_units('seconds') >= $min_gap) {
                    print "--- GAP: " . $span->format_duration_between($prev, $ts) . " ---\n";
                }
            }
            $prev = $ts;
        }
        print $line;
    }

Nifty huh? But this didn't actually do anything. The output of `parse_datetime` was
undefined! After adding some error handling, I discovered **Relevation #1: BST is ambiguous.**
[[DateTime::Format::Strptime]] refuses to parse BST because it _might_ be an abbreviation
for "Bangladesh Summer Time" as well as "British Summer Time", despite me providing an
appropriate locale and time zone in the constructor. (A similar issue appears with EST.)

Okay, so I added a quick `s/ BST$/+0100/`, `s/ GMT$/+0000/` and changed `%Z` to `%z` in the
format string and it appeared to work![^tz] But due to previous work with DateTime, I had a
suspicion that it wouldn't recognise gaps of 60 seconds or more.

My suspicion was confirmed! Up to 59 seconds, worked fine. 60? No deal. How come? The reason
is **Relevation #2: minutes cannot be converted into seconds.** DateTime is a perfectionist
to a fault, and because of [[w:leap_seconds]], a minute may contain 60 or 61 seconds. Because
this is ambiguous, if you ask for seconds, `in_units('seconds')` _only_ returns the seconds
part of the duration!

Dave Rolsky (the primary author of DateTime!) suggested the `subtract_datetime_absolute`
method as a solution to this problem; this returns a duration object that only includes
seconds and nanoseconds:

    :::perl
    my $delta = $ts->subtract_datetime_absolute($prev);
    if ($delta->in_units('seconds') >= $min_gap) { ... }

Finally, it was working ... sort of. Processing a 320k line log file took almost four
minutes! Profiling it showed that most of the time was spent in:

 * `DateTime::TimeZone::_spans_binary_search`
 * `Params::Validate::_validate`

**Relevation #3: Time zone calculations are very slow.**[^version] Since I'm not so bothered
about time zones, can I speed this up?

Using `set_time_zone` to set UTC or floating time zones did not bear fruit; presumably,
we still perform a time zone conversion for each line. Stripping the timezone and adding an hour
manually for BST made it take even longer!

Curious, I decided to try some other modules, [[Date::Parse]] and [[Time::Duration]].
(I also tried [[Time::Piece]], but its implementation of `strptime` complained that
BST was "trailing garbage", even though I specified `%Z`).

## Take Two ##

Aside from being smaller, this version processes 320k lines in 18 seconds:

    :::perl
    $line =~ /^\[ ([^\[]+) \]/x or next;
    my $ts = str2time($1);
    if (defined $ts) {
        if (defined $prev) {
            my $delta = $ts - $prev;
            if ($delta >= $min_gap) {
                print "--- GAP: " . duration($delta) . " ---\n";
            }
        }
        $prev = $ts;
    }
    print $line;

([full version](https://gist.github.com/richardjharris/5288203))

## The Final Cut ##

`str2time` is a heuristic parser; replacing it with a regex brings the time down
to 3.2 seconds:

    :::perl
    sub parse_date {
        my $line = shift;
        $line =~ /^\[(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d) (\w+)/ or return;
        return mktime($6, $5, $4, $3, $2 - 1, $1 - 1900, 0, 0, $7 eq 'BST');
    }

Ugly, but fast.

## Conclusion ##

Performance is always at odds with flexibility. [[DateTime::]] tries extremely hard
to account for daylight savings, timezones and leap seconds; this level of rigorous
precision may not be appropriate for your application. On the other hand, most
applications do not care about the performance of date calculations.

Dates and times can get very, very complex. Read the docs of your chosen module
and be aware of edge cases (like `in_units` refusing to convert from minutes to
seconds) before they bite you.

---

## Bonus! ##

Let's see how well these versions cope with the [[w:Year_2038_problem]]!

Input:

    [2013-04-01 21:03:01 BST] Taking a trip to the year 3000...
    [2013-04-01 21:03:01 BST] (not much has changed but they live underwater)
    [3000-01-01 00:00:00 BST] Your great, great great grand daughter is: pretty fine

DateTime performs impeccably, although it does take about 4 seconds, because it has
to do time zone calculations spanning 1,000 years.[^span]

    [2013-04-01 21:03:01 BST] Taking a trip to the year 3000...
    [2013-04-01 21:03:01 BST] (not much has changed but they live underwater)
    --- GAP: 986 years, 8 months, 4 weeks, 2 days, 1 hour, 56 minutes, and 59 seconds ---
    [3000-01-01 00:00:00 BST] Your great, great great grand daughter is: pretty fine

Date::Parse is not having fun, because Perl < 5.12.0 has 32-bit times: [^perl512]

    Day too small - -317761 > -24856
    Sec too small - -317761 < 74752

Ugly regex version:

    [2013-04-01 21:03:01 BST] Taking a trip to the year 3000...
    [2013-04-01 21:03:01 BST] (not much has changed but they live underwater)
    --- GAP: 987 years and 149 days ---
    [3000-01-01 00:00:00 BST] Your great, great great grand daughter is: pretty fine

**Ugly regex wins!**

(Sadly, that's been the case more often than I'd like to admit...)

*[BST]: British Summer Time (or apparently Bangladesh Summer Time)
*[EST]: Eastern Standard Time in the United States (but also Australian Eastern Standard Time)
*[UTC]: Coordinated Universal Time, or +0000.
*[GMT]: Greenwich Mean Time (used in Commonwealth countries to refer to UTC)
[^tz]: As I live in the United Kingdom, these logs are only going to be in either BST or GMT depending on the time of year.
[^version]: CentOS 5 provides DateTime version 0.41. I tested version 1.01, but it did not show a notable speed improvement.
[^span]: This is explicitly mentioned in the perldoc; the workaround is to use UTC/floating.
[^perl512]: It works great on newer Perls, but CentOS probably won't have upgraded to 5.12 by 2038 :)
