/**
 * Keeps a link looking as it did when you chose it, through the transition.
 *
 * Once a transition starts, its layer covers the page and the pointer is no
 * longer over the link, so its hover looks (an underline, a darker name, the
 * others stepping back) would snap off halfway. This marks the link that
 * started the navigation (`data-chosen`), and the CSS styles the mark like a
 * hover: `[data-chosen]` next to `:hover`. The still copy of the page that
 * some transitions keep has the mark too, and it goes with the old page.
 */
import { onPage } from '../../lib/interlude';

// `() => true`: every page.
onPage(() => true, {
  leave({ trigger }) {
    trigger?.closest('a')?.setAttribute('data-chosen', '');
  },
});
