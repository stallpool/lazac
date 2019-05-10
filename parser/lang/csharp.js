const i_common = require('../common');
const i_extractor = require('../extractor');
const i_decorator = require('../decorator');

const csharp_extract_feature = {
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

const csharp_keywords = [
   // ref:
   // - https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/
   // - https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/preprocessor-directives/
   'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
   'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
   'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false',
   'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit',
   'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace',
   'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
   'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
   'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw',
   'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort',
   'using', 'virtual', 'void', 'volatile', 'while',

   'add', 'alias', 'ascending', 'async', 'await', 'by', 'descending', 'dynamic', 'equals',
   'from', 'get', 'global', 'group', 'into', 'join', 'let', 'nameof', 'on',
   'orderby', 'partial', 'remove', 'select', 'set', 'value', 'var', 'when',
   'where', 'yield',

   '#if', '#else', '#elif', '#endif', '#define', '#undef', '#warning', '#error', '#line',
   '#region', '#endregion', '#pragma',
];

const csharp_combinations = [
   '++', '--', '+=', '-=', '*=', '/=', '%=', '==',
   '!=', '>=', '<=', '->', '&&', '||', '<<', '>>',
   '&=', '|=', '^=', '<<=', '>>=', '??', '=>',
   ['#', 'region'], ['#', 'endregion'],
   ['#', 'if'],
   ['#', 'else'], ['#', 'elif'], ['#', 'endif'],
   ['#', 'pragma'], ['#', 'error'], ['#', 'define'],
   ['#', 'undef'], ['#', 'warning'], ['#', 'line'],
];

const csharp_decorate_feature = {
};

function tokenize(env) {
   env.curosr = 0;
   i_extractor.extract_tokens(env, csharp_extract_feature);
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
