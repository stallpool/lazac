const i_common = require('../common');
const i_extractor = require('../extractor');
const i_decorator = require('../decorator');

const c_extract_feature = {
   '"': [extract_string],
   '\'': [extract_char],
   '/': [extract_line_comment, extract_multiline_comment]
};

function extract_string(env) {
   return i_extractor.extract_string(env, '"', '"', '\\');
}

function extract_char(env) {
   return i_extractor.extract_string(env, '\'', '\'', '\\');
}

function extract_line_comment(env) {
   return i_extractor.extract_comment(env, '//', '\n');
}

function extract_multiline_comment(env) {
   return i_extractor.extract_comment(env, '/*', '*/');
}

const c_keywords = [
   // ref:
   // - https://en.cppreference.com/w/c/keyword
   'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double',
   'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register',
   'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef',
   'union', 'unsigned', 'void', 'volatile', 'while',
   /* C99 */ '_Bool', '_Complex', '_Imaginary', 'inline', 'restrict', '_Pragma',
   /* C11 */ '_Alignas', '_Alignof', '_Atomic', '_Generic', '_Noreturn', '_Static_assert',
   '_Thread_local',
   /* C extension */ 'asm', 'fortran',
   '#if', '#ifdef', '#ifndef', '#else', '#elif', '#endif', '#pragma', '#error',
   '#define', '#undef', '#line', 'defined', '#include',
];

const c_combinations = [
   '++', '--', '+=', '-=', '*=', '/=', '%=', '==',
   '!=', '>=', '<=', '->', '&&', '||', '<<', '>>',
   '&=', '|=', '^=', '<<=', '>>=',
   // XXX: currently do not support "#     ifdef TEST ..."
   ['#', 'include'],
   ['#', 'if'], ['#', 'ifdef'], ['#', 'ifndef'],
   ['#', 'else'], ['#', 'elif'], ['#', 'endif'],
   ['#', 'pragma'], ['#', 'error'], ['#', 'define'],
   ['#', 'undef'], ['#', 'line'],
];

const c_decorate_precompile_feature = {
};

const c_decorate_feature = {
};

function decorate_bracket_region(env) {
   // XXX: currently assume there is no case to separte function definition:
   // cannot process:
   // e.g. int main() {
   // #ifdef A
   //    return 0;
   // }
   // #else
   //    return 1;
   // }
   // #endif
   //
   // can process:
   // e.g. int main() {
   // #ifdef A
   //    return 0;
   // #else
   //    return 1;
   // #endif
   // }
}

function tokenize(env) {
   env.cursor = 0;
   i_extractor.extract_tokens(env, c_extract_feature);
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