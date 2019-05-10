const i_common = require('../common');
const i_extractor = require('../extractor');
const i_decorator = require('../decorator');

const java_extract_feature = {
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

const java_keywords = [
   // ref:
   // - https://docs.oracle.com/javase/tutorial/java/nutsandbolts/_keywords.html
   'abstract', 'continue', 'for', 'new', 'switch', 'assert', 'default', 'goto', 'package', 'synchronized',
   'boolean', 'do', 'if', 'private', 'this', 'break', 'double', 'implements', 'protected', 'throw',
   'byte', 'else', 'import', 'public', 'throws', 'case', 'enum', 'instanceof', 'return', 'transient',
   'catch', 'extends', 'int', 'short', 'try', 'char', 'final', 'interface', 'static', 'void',
   'class', 'finally', 'long', 'strictfp', 'volatile', 'const', 'float', 'native', 'super', 'while',
   '@interface',
];

const java_combinations = [
   '!=', '+=', '-=', '~=', '|=', '&=', '^=', '++', '>=',
   '&&', '||', '>>', '<<', '%=', '*=', '/=', '--', '<=',
   '->', '>>>', '%=', '<<=', '>>=', '>>>=', '...',
   ['@', 'interface'],
];

const java_decorate_feature = {
};
const java_decorate_executable_feature = {
};

function tokenize(env) {
   env.cursor = 0;
   i_extractor.extract_tokens(env, java_extract_feature);
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
