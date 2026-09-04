import re

with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Fix login screen
code = code.replace("bg-[#F9F8F4]'}`,", "bg-[#F9F8F4] dark:bg-gray-900`}")  # wait, better to use regex
code = re.sub(r"\$\{isDarkMode \? 'bg-gray-900' : 'bg-\[#F9F8F4\]'\}", r"bg-[#F9F8F4] dark:bg-gray-900", code)
code = re.sub(r"\$\{isDarkMode \? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'\}", r"bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700", code)
code = re.sub(r"\$\{isDarkMode \? 'text-white' : 'text-gray-900'\}", r"text-gray-900 dark:text-white", code)
code = re.sub(r"\$\{isDarkMode \? 'text-gray-400' : 'text-gray-600'\}", r"text-gray-600 dark:text-gray-400", code)
code = re.sub(r"\$\{isDarkMode \? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500' : 'bg-white border-gray-200 text-gray-900 focus:border-\[#1C6B53\]'\}", r"bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:border-[#1C6B53] dark:focus:border-emerald-500", code)
code = re.sub(r"\$\{isDarkMode \? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-\[#1C6B53\] hover:bg-\[#155a45\]'\}", r"bg-[#1C6B53] dark:bg-emerald-600 hover:bg-[#155a45] dark:hover:bg-emerald-700", code)

# Fix Dashboard header responsiveness
code = code.replace('className="flex justify-between items-start w-full mb-8"', 'className="flex flex-col sm:flex-row justify-between items-start w-full mb-8 gap-4"')

# Fix Team Cards styling
old_cards_code = """                  ${isActive 
                    ? (isDarkMode ? 'bg-emerald-800 text-white border-transparent' : 'bg-[#1C6B53] text-white border-transparent')
                    : (isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-700 hover:border-gray-500' : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300')}"""
new_cards_code = """                  ${isActive 
                    ? 'bg-[#1C6B53] dark:bg-emerald-800 text-white border-transparent'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'}"""
code = code.replace(old_cards_code, new_cards_code)

# Fix Month Tabs styling
old_tabs_code = """                className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase ${
                  selectedMonth === m
                    ? (isDarkMode ? 'bg-gray-700 text-white shadow-sm' : 'bg-[#1a1a1a] text-white shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-[#EAE7DF]')
                }`}"""
new_tabs_code = """                className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase whitespace-nowrap flex-shrink-0 ${
                  selectedMonth === m
                    ? 'bg-[#1a1a1a] dark:bg-gray-700 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-[#EAE7DF] dark:hover:bg-gray-700'
                }`}"""
code = code.replace(old_tabs_code, new_tabs_code)

# Fix Month Tabs scroll wrapper responsiveness
code = code.replace('className="flex flex-wrap gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700"', 'className="flex overflow-x-auto w-full gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700 no-scrollbar"')

# Fix search bar / manage responsiveness
code = code.replace('className="flex items-center gap-3"', 'className="flex flex-wrap items-center gap-3 w-full xl:w-auto"')
code = code.replace('className="relative"', 'className="relative flex-grow sm:flex-grow-0"')
code = code.replace('className="pl-9 pr-4 py-1.5 border border-gray-200 dark:border-gray-700 rounded-sm bg-white dark:bg-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 text-sm w-48 transition dark:text-gray-200"', 'className="pl-9 pr-4 py-1.5 border border-gray-200 dark:border-gray-700 rounded-sm bg-white dark:bg-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 text-sm w-full sm:w-48 transition dark:text-gray-200"')

with open("src/app/page.tsx", "w", encoding="utf-8") as f:
    f.write(code)
