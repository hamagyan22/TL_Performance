import re

with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace('className="flex overflow-x-auto w-full gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700 no-scrollbar"', 'className="flex flex-wrap gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700"')

with open("src/app/page.tsx", "w", encoding="utf-8") as f:
    f.write(code)
