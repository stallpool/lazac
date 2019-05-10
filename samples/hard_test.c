#include <stdio.h>
#include "stdlib.h"

#define XAA
#define PI ( \
   3.14159265358979323846264338\
)
#define hello(x, y) ((x)>(y)?#x:#y)
#define BNAME(x) a(x)
#define ANAME(x) BNAME(x)
#define XXXX {
#line 13 "Xaaaa"
#pragma warnings("hello world")

int test(int x) {
   return 0;
}

int (*f ())(int) {
   return test;
}

int ANAME(int x) XXXX

# ifdef PI
   return 0;
}

#ifdef XXXX
#define PPP
#endif

int main () {
   return 1;
}
#undef XAA
#   else
   return 1;
}
int main () {
   return 2;
}
#     endif

/*
   a() {  }            /---> } 
          region: x1   |     region: x2
      startIndex: a1   | startIndex: a2
        endIndex: b1   |   endIndex: b2
           chain: -----/
 */