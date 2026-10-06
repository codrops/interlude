/**
 * The "Back" link on a transition's page acts like the browser's back button:
 * it goes back one page in the history, so the transition that brought you
 * here plays again, backwards. Without a page of this site before this one (you
 * came straight here), it's a plain link to the home page.
 *
 * An example of a page script: `onPage()` runs `init` for each transition page
 * once it's in the DOM, and the function it returns when the page leaves.
 */
import { onPage } from '../../lib/interlude';

onPage('transition', {
  init(main) {
    // In the page's <main>: the layer may still hold the old page's copy, with its own Back link.
    const link = main.querySelector<HTMLAnchorElement>('[data-back]');
    if (!link) return;

    const goBack = (event: MouseEvent) => {
      // Let the browser handle opening in a new tab or window.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      // The router numbers the history entries it creates (`index`): above 0, there's an earlier one of ours.
      if (!(history.state?.index > 0)) return;
      event.preventDefault();
      history.back();
    };
    link.addEventListener('click', goBack);
    return () => link.removeEventListener('click', goBack);
  },
});
