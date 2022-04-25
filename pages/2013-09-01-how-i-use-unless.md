Title: How I use unless
Date: 2013-09-01 20:00
Category: Programming
Tags: perl, pbp

`unless` is a language construct that I think sums up Perl in many ways. In the right
hands, such syntactic choices can bring the code closer to the problem domain, aid
readability, and allow great freedom of expression. In the wrong hands, it can produce
a horrible mess which nobody can understand.

I have some simple heuristics for applying `unless` that have worked well for me and people
who read my code:

1.  **Use unless when the condition is negative.**

    You can avoid a double-negative by using `unless` with negatively-named variables or
    functions. For example:

        :::perl
        lock() unless $skip_locking;

    ...compared with

        :::perl
        lock() if !$skip_locking;


2. **Use unless to imply success.**

    Unlike the neutral `if`, `unless` implies that the block is likely to be executed
    (i.e. the condition is unlikely to occur, just as it does in English).
    It also implies that we _want_ the block to execute.

        :::perl
        unless ($going_to_throw_up) {
            drink_shot();  # implication: throwing up is unlikely. Cheers!
        }

    vs.

        :::perl
        if ( ! $going_to_throw_up ) {
            drink_shot();   # implication: uhm, I'm feeling a little woozy...
        }

    Even the notorious double negative can work in this context.

        :::perl
        unless ( ! file_readable($fh) ) {
            # do some shiz with $fh
        }

    Contrast with the more neutral <span style="white-space: nowrap">`if ( file_readable($fh) )`</span>.

3.  **Don't use unless for complex expressions.**

    If the programmer needs to apply DeMorgan's law to understand the conditional,
    use `if` and apply it immediately. For instance, which of these two are more
    readable?

        :::perl
        unless ( $have_work && !$sunday ) {
            sleep_in();
        }

        if ( !$have_work || $sunday ) {
            sleep_in();
        }

    Most likely, you had to mentally transform the `unless` to an `if` to understand
    it; in these cases, using `if` is better.

    Of course, even if you use `unless` because a conditional is simple, it could get
    more complicated later. Refactoring the conditional into its own function or method
    protects you from this.

        :::perl
        unless ( $query->param('queue')
              or $query->param('language')
              or $query->param('domain') ) {
            # Provide default status filter
        }

        unless ($query->has_status_filter) {
            # Provide default status filter
        }

4.  **Don't use unless if you have an `elsif` or `else` block.**

        :::perl
        unless ($foo) {
            ...
        }
        else {
            ...
        }

    Yep.
