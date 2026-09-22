/* MTM's curated library. Change pinOrder to move featured books; omit it to unpin.
 * Unpinned books keep their order below. Retailer details checked September 22, 2026.
 */
(() => {
  "use strict";
  const books = [
    { pinOrder: 1, title: "Being Different Doesn't Mean Less", credit: "Nature Decker", details: "Hardcover · 28 pages", url: "https://www.barnesandnoble.com/w/being-different-doesnt-mean-less-nature-decker/1151402809", retailer: "Barnes & Noble", blurb: "On his first day of school, Cash finds friendship as classmates learn to understand his signs and gestures. A picture book about different ways of communicating, inclusion, and belonging." },
    { pinOrder: 2, title: "Poppy's First Time At The Beach", credit: "Cliff Blackwood", details: "Paperback · 24 pages · Ages 2–8", url: "https://a.co/d/0fZaQpiS", retailer: "Amazon", blurb: "Join Poppy on a first trip to the beach, where warm sand and seaside discoveries spark curiosity and friendship. A gentle illustrated adventure to share with young readers." },
    { title: "I Love You Like No Otter", credit: "Rose Rossner · Illustrated by Sydney Hanson", details: "Hardcover · 32 pages", url: "https://a.co/d/00C5NWaP", retailer: "Amazon", blurb: "Playful animal puns and affectionate illustrations turn a simple message of love into a cheerful read-aloud. A sweet choice for sharing a giggle and a cuddle at bedtime." },
    { title: "Be Brave Little One", credit: "Marianne Richmond", details: "Hardcover · 40 pages", url: "https://a.co/d/0dEDPMq4", retailer: "Amazon", blurb: "An encouraging picture book celebrating the many ways children can be brave. Its reassuring message cheers little ones on as they try new things and face everyday challenges." },
    { title: "I'll Be Here", credit: "Alicia Kennedy", details: "Hardcover · 48 pages · Ages 4–9", url: "https://a.co/d/04C4hzTj", retailer: "Amazon", blurb: "From early steps to bigger adventures, this story follows the steady love of a parent or caregiver. A reassuring reminder that children have someone beside them as they grow." },
    { title: "Shell Days with Turtle", credit: "Little Hippo Books · Illustrated by Gabriele Tafuni", details: "Touch-and-feel board book · 12 pages", url: "https://a.co/d/073tb9If", retailer: "Amazon", blurb: "Follow Turtle through daily adventures in and out of the water. Rhyming words and touch-and-feel details invite little readers to explore the pages with their hands as well as their eyes." },
    { title: "Infantino Color Reveal Ocean Bath Book", credit: "Infantino", details: "Reusable sensory bath book · 4 pages", url: "https://a.co/d/0ij4mZLx", retailer: "Amazon", blurb: "Sea creatures appear in color when this soft bath book gets wet, then return to black and white as it dries. A reusable, hands-on way to explore ocean pictures during bath time." }
  ];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  window.MTMBookLibrary = {
    render() {
      const ordered = [...books].sort((a, b) => (a.pinOrder ?? Infinity) - (b.pinOrder ?? Infinity));
      return `<section class="book-library" aria-labelledby="book-library-title"><h2 id="book-library-title" class="section-title">Build Your Child’s Library</h2><p class="book-library-intro">Books selected by More Than Measured for stories, connection, and discovery together.</p><ol class="book-library-list">${ordered.map((book, index) => `<li class="card book-library-card"><div class="book-library-heading"><span class="book-library-number" aria-hidden="true">${index + 1}</span>${book.pinOrder ? '<span class="book-library-featured">Featured</span>' : ''}</div><h3>${escape(book.title)}</h3><p class="book-library-credit">${escape(book.credit)}</p><p class="book-library-details">${escape(book.details)}</p><p class="book-library-blurb">${escape(book.blurb)}</p><a class="book-library-link" href="${escape(book.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`View ${book.title} at ${book.retailer} (opens in a new tab)`)}">View at ${escape(book.retailer)} <span aria-hidden="true">↗</span></a></li>`).join('')}</ol></section>`;
    }
  };
})();
