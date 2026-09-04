import re

with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

old_block = """        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-4">
          <div className="flex flex-wrap gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 mr-2 rounded-sm text-[11px] font-bold tracking-wider uppercase bg-[#1a1a1a] dark:bg-gray-900 text-white shadow-sm outline-none cursor-pointer border border-transparent dark:border-gray-700"
            >
              <option value="2026">2026</option>
              <option value="2027">2027</option>
              <option value="2028">2028</option>
              <option value="2029">2029</option>
              <option value="2030">2030</option>
            </select>
            {months.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase whitespace-nowrap flex-shrink-0 ${
                  selectedMonth === m
                    ? 'bg-[#1a1a1a] dark:bg-gray-700 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-[#EAE7DF] dark:hover:bg-gray-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>"""

new_block = """        <div className="flex flex-col xl:flex-row justify-between items-end mb-4 gap-4">
          <div className="flex flex-col gap-2 w-full xl:w-auto">
            <div className="flex flex-wrap gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 mr-2 rounded-sm text-[11px] font-bold tracking-wider uppercase bg-[#1a1a1a] dark:bg-gray-900 text-white shadow-sm outline-none cursor-pointer border border-transparent dark:border-gray-700"
              >
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
                <option value="2029">2029</option>
                <option value="2030">2030</option>
              </select>
              {months.slice(0, 12).map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase whitespace-nowrap flex-shrink-0 ${
                    selectedMonth === m
                      ? 'bg-[#1a1a1a] dark:bg-gray-700 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-[#EAE7DF] dark:hover:bg-gray-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700">
              {months.slice(12).map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase whitespace-nowrap flex-shrink-0 ${
                    selectedMonth === m
                      ? 'bg-[#1a1a1a] dark:bg-gray-700 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-[#EAE7DF] dark:hover:bg-gray-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>"""

if old_block in code:
    code = code.replace(old_block, new_block)
    with open("src/app/page.tsx", "w", encoding="utf-8") as f:
        f.write(code)
    print("Success")
else:
    print("Could not find block")
