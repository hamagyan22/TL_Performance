import re

with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

old_block = """        {/* Month Tabs & Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-4">
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
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-gray-200 dark:border-gray-700 rounded-sm bg-white dark:bg-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 text-sm w-full sm:w-48 transition dark:text-gray-200"
              />
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium tracking-wide whitespace-nowrap">
              {rows.length} agents
            </span>
            <button
              onClick={() => setShowManageMembers(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition rounded-sm text-xs font-bold tracking-wider uppercase shadow-sm"
            >
              <Users size={13} />
              Manage
            </button>
          </div>
        </div>"""

new_block = """        {/* Month Tabs & Controls */}
        <div className="flex flex-col mb-4 gap-4">
          
          {/* Top Row: Search and Manage */}
          <div className="flex flex-row items-center gap-3 w-full justify-start">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-gray-200 dark:border-gray-700 rounded-sm bg-white dark:bg-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 text-sm w-full sm:w-48 transition dark:text-gray-200"
              />
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium tracking-wide whitespace-nowrap">
              {rows.length} agents
            </span>
            <button
              onClick={() => setShowManageMembers(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition rounded-sm text-xs font-bold tracking-wider uppercase shadow-sm"
            >
              <Users size={13} />
              Manage
            </button>
          </div>

          {/* Bottom Row: Month Tabs (One Line, No Scroll) */}
          <div className="flex flex-nowrap gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700 w-full overflow-hidden">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 mr-2 rounded-sm text-[11px] font-bold tracking-wider uppercase bg-[#1a1a1a] dark:bg-gray-900 text-white shadow-sm outline-none cursor-pointer border border-transparent dark:border-gray-700 flex-shrink-0"
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
                className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase whitespace-nowrap flex-shrink-1 min-w-0 ${
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
