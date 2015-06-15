Title: All sorts of things you can get wrong in Unicode, and why
Category: Unicode
Tags: perl, unicode, stackoverflow
Date: 2013-09-01 20:00

If you've read this [StackOverflow post][stack], you know about all the things you can
get wrong when using Unicode. This post explains _why_.

If you are not too familiar with Unicode, please read my [introductory
article](|filename|/unicode-in-five-minutes.markdown) first.

## General Unicode Assumptions ##

> Code that assumes that web pages in Japanese or Chinese take up less space
> in UTF-16 than in UTF-8 is wrong.

The majority of characters in an HTML document are markup (tags) and line
terminators, not content. For _plain text_, UTF-16 is a more compact encoding,
as it represents code points between U+0800 and U+FFFF in 2 bytes rather than 3 -
this range includes most commonly used CJKV characters.

Of course, HTML markup and line terminators are all firmly in the ASCII range,
and represented as a single byte in UTF-8, but two in UTF-16.

There's another downside to using UTF-16 in web pages: you'll have to specify
the encoding in your HTTP header. On the other hand, browsers are able to treat
UTF-8 data as ASCII until they find a charset `meta` tag.

> Code that assumes roundtrip equality on casefolding, like `lc(uc($s)) eq $s` or
> `uc(lc($s)) eq $s`, is completely broken and wrong.

(Assuming `$s` is a single character)

tchrist already provides an example of u{03C3} and u{03C2}. The latter is for
the last character in a word; both have an uppercase u{03A3+} but the lowercase of
u{03A3} is u{03C3}.

There's also u{00DF+} which is 'SS' in uppercase, and therefore 'ss' when mapped
back to lowercase!

Finally, there's u{01F2} which is u{01F1} in upper-case, and u{01F3} after
mapping to lower-case again.

When you need to do case-insensitive comparisons, do a Unicode casefold on all
the strings and compare those. Casefolding is explicitly a one-way operation.

> Code that assumes changing the case doesn’t change the length of the string is
> broken.

There are plenty of counterexamples, including u{FB00} which uppercases to 'FF';
the aforementioned u{00DF}; and 101 other codepoints.

> Code that believes that stuff like `/s/i` can only match "S" or "s" is broken
> and wrong. You’d be surprised.

It also matches u{017F}. Similarly, `/k/i` matches u{212A+}.
In both cases, the `/i` flag is required.

> Code that assumes that it cannot use `\x{FFFF}` is wrong.

The codepoint U+FFFF is illegal for 'open interchange'; that is, it can be used
_internally_ but should not form part of your program's output.

> Code that believes things like ₨ contain any letters in them is wrong.

I am unsure about this because u{₨} has a _compatibility decomposition_ to 'R' 's'
(see the [code chart][decompchart]). In general though, u{₨}  won't match a regex
search for 'R' or 's' unless decomposed as above. It also won't match `\p{Letter}`
or `\p{Alphabetic}`.

> Code that converts unknown characters to ? is broken, stupid, braindead, and
> runs contrary to the standard recommendation, which says NOT TO DO THAT!
> RTFM for why not.

Unicode says text processors are allowed to not know about a codepoint (e.g.
higher Unicode version, or a Private Use character) but they should pass it
through unchanged. Replacing them with '?' destroys data.

Not to be confused with u{FFFD+#}, used to replace
characters that are unknown or not representable in Unicode. [Defined
here][unicodestdconformance].

> Code that assumes only letters have case is broken. Beyond just letters, it
> turns out that numbers, symbols, and even marks have case. In fact,
> changing the case can even make something change its main general category,
> like a `\p{Mark}` turning into a `\p{Letter}`. It can also make it switch from one
> script to another.

I'll illustrate this with examples.

 * Roman numerals such as u{ⅷ}  and u{Ⅷ} clearly have case.
 * The u{µ+} resides in the Common script for compatibility with Latin-1,
   but uppercases to u{GREEK CAPITAL LETTER MU+}, in Greek.
 * Letters in circles such as u{ⓗ} are cased, but have
   `\p{General_Category=Symbol}`.
 * The mark u{0345'+} is cased; it uppercases to u{0399+}.

As an aside, 129 codepoints are `\p{Cased}`, but map only to themselves.

> Code that assumes that case is never locale-dependent is broken.

Casing is dependent on both language and the context of the character (for
example if it appears in the middle or at the end of a word). See
[SpecialCasing][] for a few examples.

One example of language-dependent casing is whether or not to keep accents in
capital letters.

> Code that assumes there is only two cases is broken. There's also titlecase.

Titlecase is used for ligatures and digraphs such as 'fl', 'dz' and 'lj', which
need special handling. For example, u{01C7} titlecases to u{01C8} rather than u{01C9}.

> Code that assumes characters like &gt; always points to the right and &lt; always
> points to the left are wrong — because they in fact do not.

When using Right-to-Left rendering, glyphs such as &gt; change appearance to &lt; to
account for the change of direction. )Otherwise parentheses would look odd(

> Code that assumes that all `\p{Math}` code points are visible characters is
> wrong.

Four are invisible! They are intended for use in equations:

* u{2061+!} &mdash; e.g. sin&#x2061;_x_
* u{2062+!} &mdash; e.g. 2&#x2062;_n_
* u{2063+!} &mdash; matrix indices: a<sub>i&#x2063;j</sub>
* u{2064+!} &mdash; intended for fractions, such as 3&#x2064;&#x00BD;

This could allow renderers to do nifty things like line break in the middle of
2&#x2062;_n_ and insert a multiplication sign (&times;). The invisible plus is
especially weird because as an operator, it would hold a higher precedence than
multiplication!

Realistically though, dedicated math markup is best for this sort of thing.

> Code that believes you can use u{🐪} (Perl) printf widths to pad and justify Unicode data
> is broken and wrong.

You can't, because some characters have no width (combining accents, control
characters) while some have double-width (CJKV ideographs, 'full-width' letters).

Most likely `printf` will interpret each codepoint as a character with a width
of one, so for things like Chinese it'll pad completely wrong.

For Perl the solution is [[Unicode::GCString]].

> Code that assumes every code point takes up no more than one print column is broken.

Ideographic characters (CJKV) typically take up two print columns. More generally,
anything with `East_Asian_Width` equal to `Wide` or `Fullwidth` (u{ᄈ }, u{￡}).
This includes variants of the Latin alphabet, punctuation and numbers, which are
designed to play nicely with CJKV characters.

> Code that assumes that diacritics `\p{Diacritic}` and marks `\p{Mark}` are the
> same thing is broken.

Confusing nomenclature. If you care, read on.

`\p{Mark}` is a general category composed of `\p{Nonspacing_Mark}` (zero-width),
`\p{Spacing_Mark}` (positive width) and `\p{Enclosing_Mark}`, all of which are
combining characters. `\p{Diacritic}` is a character property meaning 'a character
that linguistically modifies the meaning of another character to which they apply',
but may or may not be combining.

Marks (combining characters) that are not diacritics include general purpose combining
characters like small Latin letters u{036a'}, vowel signs[^vowel], and variation selectors.
There are 1,068 in total.

Diacritics that are not marks include Latin-1 characters such as u{^} and u{0060},
full-width accents (u{ff3e}, u{ff40}) and 'modifier letters' such as u{02b0}. There
are 209 in total.

> Code that assumes that all `\p{Mark}` characters take up zero print columns is broken.

As discussed, `\p{Mark}` includes spacing characters of non-zero width. They are mostly
vowel signs.

> Code that assumes `\p{GC=Dash_Punctuation}` covers as much as `\p{Dash}` is broken.

Four code points in other general categories have the `Dash` property:
u{2053+}, u{207b+}, u{208b+}, u{2212+}. Exciting! The latter three are in the "Math
Symbol" category.

> Code that assumes dash, hyphens, and minuses are the same thing as each other,
> or that there is only one of each, is broken and wrong.

Hyphens and minus signs are naturally different, and the main reason we use u{-+}
for both is ASCII legacy. Unicode supplies dedidated characters for both, u{2010+}
and u{2212+}, which your editor could substitute automatically.

Naturally there are lots of variants of each, such as u{2013+} and u{2014+},
u{2e17+}, u{2796+}.

## Regular Expression Assumptions ##

> Code that believes `\p{InLatin}` is the same as `\p{Latin}` is heinously broken.

`\p{InLatin}` does not exist in my Perl 5.16, but `\p{InLatin1}` does: it's the
same as `\p{Block=Latin1}` (filters by block). In contrast, `\p{Latin}` is
equivalent to `\p{Script=Latin}` (filters by script). See [[perluniprops]] for
gory details.

These are clearly different; the Latin-1 block contains all kinds of junk,
including control characters, superscripts, fractions and currency signs. In the
other direction, Latin can be found in the ASCII block, and elsewhere.

> Code that believes that `\p{InLatin}` is almost ever useful is almost certainly
> wrong.

Again, assuming `\p{InLatin1}`, it would be useless as the block has such a
diverse set of characters.

> Code that believes that given `$FIRST_LETTER` as the first letter in some
> alphabet and `$LAST_LETTER` as the last letter in that same alphabet, that
> `[${FIRST_LETTER}-${LAST_LETTER}]` has any meaning whatsoever is almost
> always completely broken and wrong and meaningless.

Unicode places no semantic value on the codepoint number. It may or may not be
related to nearby codepoints; if it is, it's usually just because that was
convenient when assigning them.

Alphabets vary by locale; while `[a-z]` works OK for English (many may disagree...),
the Danish/Norweigian alphabet includes æ, ø, and å at the end. `[a-å]` matches a
huge chunk of ASCII and Latin-1, included most capital accented characters,
Latin-1 control characters, and punctuation. Not ideal.

> Code that assumes `\w` contains only letters, digits, and underscores is wrong.

`\w` is generally locale specific for any POSIX-compatible regex engine.

For Perl 5.14+, `\w` matches "anything that is a letter or digit
_somewhere_ in the world", but _also_ includes "connector punctuation marks and
Unicode marks" ([[perlre]]). This means vowel signs and combining accents. Use
the regular expression `/a` flag to get a more legacy behaviour where `\w` is just
`[a-z0-9_]` and `\d` is `[0-9]`.

In other languages, see documentation to see which definition of `\w` applies.

## Perl Unicode Assumptions ##

> Code that assumes Perl uses UTF‑8 internally is wrong.
> Code that assumes Perl code points are limited to `0x10_FFFF` is wrong.

Wrong in multiple ways.

 * Perl uses a [very permissive variant][perlutf8] of UTF-8 it calls 'utf8' which allows
   very high codepoints (beyond `0x10_FFFF`) and illegal characters or
   sequences.
 * Perl may use ISO-8859-1 if the string's `UTF8` flag is unset.
 * On EBCDIC platforms, different encodings may be used.

The idea is that Perl's internal representation is abstract; you should not rely
on it; you should be blissfully unaware of it and just [decode][Encode] input
data into Perl's representation, and then [encode][Encode] when outputting it.

Unfortunately that is not true of Perls before 5.14 due to a variety of bugs,
including [The Unicode Bug][].

> Code that assumes you can set `$/` to something that will work with any valid
> line separator is wrong.

The set of valid Unicode linebreak sequences requires a regex, but `$/` can only
be a single string. You can use `\R` in regular expressions to do The Right Thingu{2122}.
(see [[perlrebackslash#Misc]])

### Much Ado About `\X` ###

So `\X` matches an 'extended grapheme cluster' which is basically what a user would
think of as a character. It accounts for decomposed Hangul, Latin characters with
combining diacritics, and so on.

> Code that uses `\PM\pM*` to find grapheme clusters instead of using `\X` is broken and wrong.

`\PM\pM*` means a non-mark char followed by zero or more mark chars. It has a couple
of major differences I think:

* `\X` handles decomposed Hangul and regional indicators
* `\X` uses Unicode's `Grapheme_Cluster_Break` properties instead of the `Mark` general category.

In short, it's much better, but more complicated, so PCRE implements `\X` as `\PM\pM*` instead.

> Code that assumes `\X` can never start with a `\p{Mark}` character is wrong.

Vowel signs (again!) are in `\p{Grapheme_Base}` but also `\p{Mark}`, so `\X` may start with them.
This makes sense if you think about it.

If it's at the start of the string, `\X` will match anything.

> Code that assumes there is a limit to the number of code points in a row that
> just one `\X` can match is wrong.

This can be seen from the grammar of `\X`:

    # All the tables with _X_ in their names are used in defining \X handling,
    # and are based on the Unicode GCB property.  Basically, \X matches:
    #   CR LF
    #   | Prepend* Begin Extend*
    #   | .
    # Begin is:           ( Special_Begin | ! Control )
    # Begin is also:      ( Regular_Begin | Special_Begin )
    #   where Regular_Begin is defined as ( ! Control - Special_Begin )
    # Special_Begin is:   ( Regional-Indicator+ | Hangul-syllable )
    # Extend is:          ( Grapheme_Extend | Spacing_Mark )
    # Control is:         [ GCB_Control | CR | LF ]
    # Hangul-syllable is: ( T+ | ( L* ( L | ( LVT | ( V | LV ) V* ) T* ) ))

(Prepend, Extend, L/T/V etc. come from the `Grapheme_Cluster_Break` property).

So it'll slurp up all regional indicator characters and any number of L/V/T
components in a decomposed Hangul syllable construction.

> Code that assumes that `\X` can never hold two non-`\p{Mark}` characters is wrong.

Hangul components aren't in `\p{Mark}`, for example. There are also `\p{Grapheme_Extend}`
code points that lie outside `\p{Mark}`, such as u{200C!} and u{200D!}.

### Encoding Assumptions ###

> Code that believes UTF-16 is a fixed-width encoding is stupid, broken, and wrong.

The confusion arises from UTF-16 using a fixed 2 bytes for every codepoint inside the
BMP, which is the 63K most common codepoints. Outside the BMP (~1M codepoints),
they must be represented in 4 bytes via a surrogate pair consisting of one high
and one low surrogate character.

Many programs assume UTF-16 is fixed width for performance reasons. These programs are
broken unless they account for surrogates at some stage.

Even if you account for this though, you still need to worry about combining
characters, whatever the encoding; one codepoint is not one character.

> Code that assumes the CESU-8 is a valid UTF encoding is wrong. Likewise, code that thinks
> encoding U+0000 as "\xC0\x80" is UTF-8 is broken and wrong.

[CESU-8][tr26] is easily confused with UTF-8; it is similar, except codepoints outside the BMP
are represented with UTF-16 surrogates which are themselves 'encoded' in a similar manner to
UTF-8. It is not a valid UTF encoding because UTF encodings don't define how to encode surrogates.
It's also not part of the Unicode Standard.

Null bytes are encoded as `\xC0\x80` to allow `\x00` to be used as an end-of-string marker
in C-like languages. This is not valid UTF-8 because UTF-8 requires the most minimal byte sequence to be
used for each codepoint, which for codepoint 0 would be `\x00`.

Curiously, Oracle and MySQL databases use CESU-8 internally but call it 'UTF-8'.

### In case of mistakes ###

If you come across anything misleading or just plain wrong, please [e-mail me][].

### Acknowledgements ###

Thanks to James Stanley for catching some formatting errors.

[stack]: http://stackoverflow.com/questions/6162484/why-does-modern-perl-avoid-utf-8-by-default/6163129#6163129
[e-mail me]: mailto:richardjharris@gmail.com
[Encode]: http://perldoc.perl.org/Encode.html
[The Unicode Bug]: http://perldoc.perl.org/perlunicode.html#The-%22Unicode-Bug%22
[perlutf8]: http://perldoc.perl.org/Encode.html#UTF-8-vs.-utf8-vs.-UTF8
[decompchart]: http://www.unicode.org/charts/PDF/U20A0.pdf
[unicodestdconformance]: http://www.unicode.org/standard/principles.html#Conformance
[SpecialCasing]: ftp://ftp.unicode.org/Public/UNIDATA/SpecialCasing.txt
[tr26]: http://www.unicode.org/reports/tr26/
*[PCRE]: Perl Compatible Regular Expressions library, used by many other languages
*[ISO-8859-1]: aka Latin-1
*[EBCDIC]: Extended Binary Coded Decimal Interchange Code, used by IBM mainframes
*[POSIX]: Portable Operating System Interface, a family of OS compatibility standards
*[CJKV]: Chinese, Japanese, Korean and Vietnamese
*[BMP]: Basic Multilingual Plane
[^vowel]: Vowel signs are used in scripts such Arabic where written vowels are optional.
