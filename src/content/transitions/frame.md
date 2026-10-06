---
group: page
order: 6
summary: 'A red rectangle grows from the middle of the screen, and the next page grows inside it, in a red frame.'
poster: ../../assets/transitions/frame.jpg
posterAlt: 'The frame transition halfway: a window onto the next page inside a red frame, growing from the middle of the screen over the home page.'
---

Nothing moves until the next page is ready; if that takes a while, a loader shows at the cursor. Then two rectangles grow from a strip in the middle of the screen: a red one, covering the old page, and a beat behind it a window onto the next page, which only catches up at the end, so the page grows inside a red frame. Going back, the same movement plays backwards: the page shrinks into a window, then the red closes.

The next page in the window is a still copy at full size: the window uncovers it, with `clip-path`, rather than scaling it.

Inspired by the page transition on [Benoît Marzouvanlian's site](https://www.benmarzouvanlian.com/).
