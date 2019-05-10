const i_common = require('../common');
const i_extractor = require('../extractor');
const i_decorator = require('../decorator');

const go_feature = {
   '"': [extract_string],
   '\'': [extract_char],
   '`': [extract_raw_string],
   '/': [extract_line_comment, extract_multiline_comment]
};

function extract_string(env) {
   return i_extractor.extract_string(env, '"', '"', '\\');
}

function extract_char(env) {
   return i_extractor.extract_string(env, '\'', '\'', '\\');
}

function extract_raw_string(env) {
   return i_extractor.extract_string(env, '`', '`', '\\');
}

function extract_line_comment(env) {
   return i_extractor.extract_comment(env, '//', '\n');
}

function extract_multiline_comment(env) {
   return i_extractor.extract_comment(env, '/*', '*/');
}

const go_keywords = [
   // ref:
   // - https://golang.org/ref/spec#Keywords
   'break', 'default', 'func', 'interface', 'select', 'var',
   'case', 'defer', 'go', 'map', 'struct', 'chan', 'else',
   'goto', 'package', 'switch', 'const', 'fallthrough', 'if',
   'range', 'type', 'continue', 'for', 'import', 'return'
];

const go_combinations = [
   '++', '--', '+=', '-=', '*=', '/=', '%=', '==',
   '!=', '>=', '<=', '&&', '||', '<<', '>>', '&=',
   '|=', '^=', '<<=', '>>=', '&^', '&^=', '<-', '...',
];

const go_decorate_feature = {
};

function detect_line_import(tokens, index) {
   // import . "fmt"
   // import _ "fmt"
   // import xxx "fmt"
   // import "fmt"
}

function decoraete_import(env) {
   // import fmt "fmt"
   // import (
   //    _ "xxx/sql"
   // )
}

function decorate_type(env) {
   // type A struct {}
   // type (
   //    A struct {}
   // )
   // type (F []int; G [][][]* interface{})
}

function decorate_interface(env) {}

function decorate_struct(env) {}

function decorate_function(env) {}

function tokenize(env) {
   env.curosr = 0;
   i_extractor.extract_tokens(env, go_feature);
   return env.tokens;
}

function parse(env) {
   tokenize(env);
   return env.tokens;
}

module.exports = {
   tokenize: (text) => tokenize({ text }),
   parse: (text) => parse({ text }),
};