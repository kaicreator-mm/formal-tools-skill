module.exports = grammar({
  name: 'numbers_demo',
  rules: {
    source_file: $ => repeat($.number),
    number: $ => /[0-9]+/
  }
});
