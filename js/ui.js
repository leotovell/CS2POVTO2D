// write the UI updating stuff here (NOT THE CANVAS UPDATES);

// export as required

/**
 * A utility function that enables a HTML loader, optionally with the given text.
 *
 * @export
 * @param {HTMLElement} loader Element containing the loader
 * @param {HTMLElement} loaderText Loader text element
 * @param {String} text Loader text
 */
export function enableLoader(loader, loaderText, text = "Loading...") {
    loader.style.display = "flex";
    loaderText.innerHTML = text;
}

/**
 * A utility function that disables a HTML Loader.
 *
 * @export
 * @param {HTMLElement} loader Element containing the loader
 */
export function disableLoader(loader) {
    loader.style.display = "none";
}

/**
 * A utility function that turns the given element visible.
 *
 * @export
 * @param {HTMLElement} element Element to turn visible
 */
export function setElementVisible(element) {
    element.style.visibility = "visible";
}

/**
 * A utility function that turns the given element invisible.
 *
 * @export
 * @param {HTMLElement} element Element to turn invisible
 */
export function setElementInvisible(element) {
    element.style.visibility = "hidden";
}
