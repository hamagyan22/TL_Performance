import re

with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace('className="flex flex-wrap items-center gap-3 w-full xl:w-auto"', 'className="flex flex-row items-center justify-start gap-3 w-full xl:w-auto mt-4 xl:mt-0"')

with open("src/app/page.tsx", "w", encoding="utf-8") as f:
    f.write(code)
