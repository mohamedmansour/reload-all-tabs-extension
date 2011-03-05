/**
 * Short form for getting elements by id.
 * @param {string} id The id.
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Build own bind function that exposes all functions.
 * From Robert Sosinski
 *  http://www.robertsosinski.com/2009/04/28/binding-scope-in-javascript/
 *
 * @param {class} scope The class to bind this function to.
 * @return {function} The scoped function binded.
 */
Function.prototype.bind = function(scope) {
  var _function = this;
  return function() {
    return _function.apply(scope, arguments);
  }
};