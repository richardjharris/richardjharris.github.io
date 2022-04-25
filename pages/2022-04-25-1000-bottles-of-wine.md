Title: 1,000 Bottles of Wine
Category: Programming
Tags: python, programming, problems
Date: 2022-04-25 19:47

So there's this king. Someone breaks into his wine cellar which stores
1,000 bottles of wine. This person proceeds to poison one of the
1,000 bottles, but gets away too quickly for the king's guard to see
which one he poisoned or to catch him.

The king needs the remaining 999 safe bottles for his party in four weeks.
The king has 10 servants who he considers disposable. The poison takes
about 3 weeks to take effect, and any amount of it will kill whoever
drinks it. How can he figure out which bottle was poisoned in time for
the party?

Solving the problem
-------------------



    ::python
    import itertools
    import random

    class Wine:
        def __init__(self):
            self.poisoned = False
        def poison(self):
            self.poisoned = True

    class Servant:
        def __init__(self, name):
            self.dead = False
            self.name = name

        def drink(self, wine):
            if self.dead:
                return
            if wine.poisoned:
                print("Arghhh! " + self.name + " has died!")
                self.dead = True

    servants = [Servant(name) for name in [
        "Bob", "Steve", "Mr. Chips", "Takeshi", "Suzuki",
        "Anthony", "Marshmallow", "Toshino", "Bumblesocks", "Monkey D. Luffy",
    ]]

    wines = [Wine() for _ in range(1000)]
    # Poison a random wine
    random.choice(wines).poison()

    # The trick is that we assign a binary number to each wine. This number's
    # 0s and 1s map to a unique combination of servants who will drink that wine.
    #  (Each servant will drink a lot of wines)
    # After 3 weeks, if that exact combination of servants die, we know which
    # wine contained the poison.

    # Consider a simpler example with 2 servants and 4 wines.
    #  Wine 0 - don't give to anyone
    #  Wine 1 - give to servant A
    #  Wine 2 - give to servant B
    #  Wine 3 - give to both servants
    #
    # After 3 weeks, if nobody dies, the poison must be in Wine 0. If A dies,
    # it's Wine 1. If B dies, Wine 2. If they both die, Wine 3.
    #
    # Mathematically speaking, each servant represents a bit of information
    # (alive/dead) and 10 servants can represent 10 bits or 2^10 (1024) states.
    # Thus we can actually check up to 1,024 wines using this method.
    for num, wine in enumerate(wines):
        # enumerate(wines) gives us a numbering from 0 to 999. We then convert
        # to binary.
        # The first wine is 0 (binary 0000000000) - nobody drinks it.
        # The second is 1 (binary 0000000001). Reading from right to left, only
        #  the first servant will drink it.
        # The last wine 999 is 1111101000 in binary. Reading from right to
        # left, servants 4,6,7,8,9 and 10 will drink it.
        to_feed = list(map(int, "{0:b}".format(num)))
        to_feed.reverse()

        for servant in itertools.compress(servants, to_feed):
            servant.drink(wine)

    # Now get the positions of our dead servants
    dead = [index for index, servant in enumerate(servants) if servant.dead]
    # Convert back from binary to decimal to get the wine number.
    poisoned_number = sum(2**x for x in dead)
    poisoned = wines[poisoned_number]
    # Now check if we were right.
    jim = Servant("Guinea Pig")
    jim.drink(poisoned)
    assert jim.dead
    print("HUZZAH! Correctly identified poisoned wine %s" % poisoned_number)

