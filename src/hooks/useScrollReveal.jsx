// import { useEffect } from 'react';

// export function useScrollReveal() {
//   useEffect(() => {
//     let io = null;
//     const observed = new WeakSet();

//     const show = (el) => {
//       el.classList.add('vis');
//     };

//     const observe = (el) => {
//       if (!el || observed.has(el) || el.classList.contains('vis')) return;
//       observed.add(el);

//       if (!io) {
//         show(el);
//         return;
//       }
//       io.observe(el);
//     };

//     const observeFrom = (root) => {
//       if (!root) return;

//       if (root.nodeType === Node.ELEMENT_NODE && root.matches('.reveal, .reveal-r')) {
//         observe(root);
//       }

//       if (typeof root.querySelectorAll === 'function') {
//         root.querySelectorAll('.reveal, .reveal-r').forEach(observe);
//       }
//     };

//     if ('IntersectionObserver' in window) {
//       io = new IntersectionObserver(
//         (entries) => {
//           entries.forEach((entry) => {
//             if (entry.isIntersecting) {
//               show(entry.target);
//               io.unobserve(entry.target);
//             }
//           });
//         },
//         { threshold: 0.07, rootMargin: '0px 0px -32px 0px' }
//       );
//     }

//     observeFrom(document);

//     // Watch for React rendering new elements dynamically
//     const mo = new MutationObserver((records) => {
//       records.forEach((record) => {
//         record.addedNodes.forEach((node) => {
//           if (node.nodeType === Node.ELEMENT_NODE) {
//             observeFrom(node);
//           }
//         });
//       });
//     });

//     if (document.body) {
//       mo.observe(document.body, { childList: true, subtree: true });
//     }

//     // Clean up observers on unmount to prevent memory leaks
//     return () => {
//       if (io) io.disconnect();
//       mo.disconnect();
//     };
//   }, []);
// }