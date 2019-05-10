const i_common = require('../common');
const i_extractor = require('../extractor');
const i_decorator = require('../decorator');

const cpp_extract_feature = {
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

const cpp_keywords = [
   // ref:
   // - https://en.cppreference.com/w/cpp/keyword
   'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double',
   'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register',
   'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef',
   'union', 'unsigned', 'void', 'volatile', 'while',
   /* C99 */ '_Bool', '_Complex', '_Imaginary', 'inline', 'restrict', '_Pragma',
   /* C11 */ '_Alignas', '_Alignof', '_Atomic', '_Generic', '_Noreturn', '_Static_assert',
   '_Thread_local',
   /* C extension */ 'asm', 'fortran',
   /* C++ */ 'and', 'and_eq', 'bitand', 'bitor', 'bool', 'break', 'catch', 'char8_t',
   'char16_t', 'char32_t', 'class', 'compl', 'const_cast', 'delete', 'dynamic_cast',
   'explicit', 'export', 'false', 'friend', 'mutable', 'namespace', 'new', 'not', 'not_eq',
   'operator', 'or', 'or_eq', 'private', 'public', 'protected', 'reinterpret_cast',
   'static_cast', 'template', 'this', 'throw', 'true', 'try', 'typeid', 'typename',
   'using', 'virtual', 'wchar_t', 'xor', 'xor_eq', 'finally',
   /* C++ 11 */ 'alignas', 'alignof', 'constexpr', 'decltype', 'noexcept', 'nullptr',
   'static_assert', 'thread_local', /* 'override', 'final' */
   /* C++ 17 */
   /* C++ 20 */ 'concept', 'consteval', 'requires', /* 'audit', 'axiom' */
   /* C++ TS */ 'atomic_cancel', 'atomic_commit', 'atomic_noexcept',
   'co_await', 'co_return', 'co_yield', 'import', 'module', 'reflexpr', 'synchronized',
   /* 'transaction_safe', 'transaction_safe_dynamic' */
   '#if', '#ifdef', '#ifndef', '#else', '#elif', '#endif', '#pragma', '#error',
   '#define', '#undef', '#line', 'defined', '#include',
];

const cpp_combinations = [
   '++', '--', '+=', '-=', '*=', '/=', '%=', '==',
   '!=', '>=', '<=', '->', '&&', '||', '<<', '>>',
   '&=', '|=', '^=', '<<=', '>>=', '::', ['#', 'include'],
   ['#', 'if'], ['#', 'ifdef'], ['#', 'ifndef'],
   ['#', 'else'], ['#', 'elif'], ['#', 'endif'],
   ['#', 'pragma'], ['#', 'error'], ['#', 'define'],
   ['#', 'undef'], ['#', 'line'], ['\\', '\n'],
];

const cpp_decorate_precompile_feature = {
};

const cpp_decorate_feature = {
};

function decorate_generic(env) {
   // http://www.cplusplus.com/doc/oldtutorial/templates/
}

function decorate_lambda_function(env) {
   // https://docs.microsoft.com/en-us/cpp/cpp/lambda-expressions-in-cpp?view=vs-2017
}

function decorate_function_with_init(env) {
   // https://en.cppreference.com/w/cpp/language/initializer_list
   // not: class A { int a = 4?(4):1+{3}; }
   // class A { int a; A() : a(3) {} }
}

function decorate_import(env) {
   // using
   // https://en.cppreference.com/w/cpp/language/namespace
   // https://en.cppreference.com/w/cpp/language/using_declaration
   // https://en.cppreference.com/w/cpp/language/type_alias
}

function tokenize(env) {
   env.curosr = 0;
   i_extractor.extract_tokens(env, cpp_extract_feature);
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