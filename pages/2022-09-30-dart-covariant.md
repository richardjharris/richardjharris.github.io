Title: Dart and covariant
Date: 2022-09-30 09:00
Category: Programming
Tags: dart
Summary: Why does Dart's operator= method use covariant? What does it mean?

When writing Dart it is common to see `operator ==(covariant Foo x)` and I wondered, what does
`covariant` mean &mdash; why is it there? Here's the result of my findings.

---

In Dart, if you override a superclass method, the arguments of the override method must have the
same type as the original.

Since `Animal.chase` in your example accepts an argument of `Animal`, you must do the same in your override:

```dart
class Cat extends Animal {
  @override
  void chase(Animal x) { ... }
}
```

Why? Imagine if there was no such restriction. `Cat` could define `void chase(Mouse x)` while `Dog` could
define `void chase(Cat x)`. Then imagine you have a `List<Animal> animals` and you call `chase(cat)` on
one of them. If the animal is a dog, it'll work, but if the animal is cat, Cat is not a Mouse! The Cat
class has no way to handle being asked to chase another Cat.

So you're forced to use `void chase(Animal x)`. We can simulate a `void chase(Mouse x)` type signature
by adding a runtime type check:

```dart
void chase(Animal x) {
  if (x is Mouse) {
    /* do chase */
  } else {
    /* throw error */
  }
}
```

It turns out this is a fairly common operation, and it would be nicer if it could be checked at compile time
where possible. So Dart added a `covariant` operator. Changing the function signature to `chase(covariant Mouse x)`
(where Mouse is a subclass of Animal) does three things:

1.  Allows you to omit the `x is Mouse` check, as it is done for you.
2.  Creates a compile time error if any Dart code calls `Cat.chase(x)` where x is not a Mouse or its subclass &mdash; if known at compile time.
3.  Creates a runtime error in other cases.

---

Another example is the `operator ==(Object x)` method on objects. Say you have a class `Point`:

You could implement `operator==` this way:

```dart
class Point {
  final int x, y;
  Point(this.x, this.y);

  bool operator==(Object other) {
    if (other is Point) {
      return x == other.x && y == other.y;
    } else {
      return false;
    }
  }
}
```

But this code compiles even if you compare `Point(1,2) == "string"` or a number or some other object. It makes no sense to compare a Point with things that aren't Points.

You can use `covariant` to tell Dart that `other` should be a Point, otherwise it's an error. This lets you drop the `x is Point` part, too:

```dart
bool operator==(covariant Point other) =>
  x == other.x && y == other.y;
```

---

**Why is it called 'covariant'?**

Covariant is a fancy type theory term, but it basically means 'this class or its subclasses'. Put another way, it means types
that are equal or lower in the type hierarchy.

You are explicitly telling Dart to tighten the type checking of this argument to a _subclass_ of the original.
For the first example: tightening Animal to Mouse; for the second: tightening Object to Point.

Useful related terms are **contravariant**, which means types equal or higher in the type hierarchy, and **invariant**,
which means exactly this type.

For more information, [this Scala Tour article] is a good resource.

[this scala tour article]: https://docs.scala-lang.org/tour/variances.html
