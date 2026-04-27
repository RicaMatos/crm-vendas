import re
import os

with open('js/ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure views directory exists
os.makedirs('js/views', exist_ok=True)

# Define regex patterns for methods to extract
methods = {
    'dashboard': [r'renderHome\(.*?\)\s*{', r'updateDashboard\(.*?\)\s*{', r'getStateColorClass\(.*?\)\s*{', r'initDashboardCharts\(.*?\)\s*{'],
    'customers': [r'renderCustomers\(.*?\)\s*{', r'getStatusClass\(.*?\)\s*{', r'bindCustomerEvents\(.*?\)\s*{', r'renderCustomerForm\(.*?\)\s*{', r'renderCustomerDetails\(.*?\)\s*{'],
    'products': [r'renderProducts\(.*?\)\s*{', r'bindProductEvents\(.*?\)\s*{', r'renderProductForm\(.*?\)\s*{'],
    'orders': [r'renderOrders\(.*?\)\s*{', r'bindOrderEvents\(.*?\)\s*{', r'renderOrderForm\(.*?\)\s*{'],
    'crops': [r'renderCrops\(.*?\)\s*{', r'bindCropEvents\(.*?\)\s*{', r'renderCropForm\(.*?\)\s*{'],
    'tasks': [r'renderTasks\(.*?\)\s*{', r'generateCalendarDays\(.*?\)\s*{', r'renderTaskCards\(.*?\)\s*{', r'bindCalendarEvents\(.*?\)\s*{', r'renderTaskForm\(.*?\)\s*{'],
    'settings': [r'renderSettings\(.*?\)\s*{']
}

def extract_method(name_pattern, source):
    # Find start
    match = re.search(name_pattern, source)
    if not match:
        return "", source
    
    start_idx = match.start()
    
    # Find matching closing brace
    brace_count = 0
    in_string = False
    string_char = ''
    i = start_idx
    
    while i < len(source):
        char = source[i]
        if char in ["'", '"', '`']:
            if not in_string:
                in_string = True
                string_char = char
            elif string_char == char and source[i-1] != '\\':
                in_string = False
        
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    break
        i += 1
    
    end_idx = i + 1
    method_content = source[start_idx:end_idx]
    new_source = source[:start_idx] + source[end_idx:]
    
    return method_content, new_source

# Process
remaining_content = content
extracted = {k: [] for k in methods.keys()}

for module, patterns in methods.items():
    for pattern in patterns:
        method_str, remaining_content = extract_method(pattern, remaining_content)
        if method_str:
            extracted[module].append(method_str)

# Add imports and exports to views
for module, methods_list in extracted.items():
    if not methods_list: continue
    
    file_content = "import { store } from '../store.js';\nimport { ui } from '../ui-core.js';\n\n"
    
    # Replace db calls with store calls
    # For now, just create a mock db object inside the module so we don't break logic immediately
    file_content += """
// Wrapper para compatibilidade com o código original (refatorar depois)
const db = {
    getAll: (col) => store.getState()[col] || [],
    getById: (col, id) => (store.getState()[col] || []).find(x => x.id == id),
    create: async (col, data) => await store.add(col, data),
    update: async (col, id, data) => await store.update(col, id, data),
    delete: async (col, id) => await store.remove(col, id)
};
"""
    
    # Export an object with the methods
    file_content += f"export const {module}View = {{\n"
    
    for i, method in enumerate(methods_list):
        # Fix the method string (it might not be comma separated if it's a class method)
        # Add comma after each method except last
        file_content += method + ("," if i < len(methods_list)-1 else "") + "\n\n"
        
    file_content += "};\n"
    
    with open(f'js/views/{module}.js', 'w', encoding='utf-8') as f:
        f.write(file_content)

# Save remaining content as ui-core.js
ui_core_content = """import { store } from './store.js';
import { auth } from './auth.js';
import { dashboardView } from './views/dashboard.js';
import { customersView } from './views/customers.js';
import { productsView } from './views/products.js';
import { ordersView } from './views/orders.js';
import { cropsView } from './views/crops.js';
import { tasksView } from './views/tasks.js';
import { settingsView } from './views/settings.js';

// Adicionando Views ao objeto ui
"""

# Adapt the class definition in remaining_content
remaining_content = remaining_content.replace('class UIService {', 'class UIService {')

# Find the end of class UIService
class_end_match = re.search(r'window\.ui\s*=\s*new\s*UIService\(\);', remaining_content)

if class_end_match:
    class_end_idx = class_end_match.start()
    ui_core_content += remaining_content[:class_end_idx]
    ui_core_content += "\nexport const ui = new UIService();\n"
    
    # Bind views to ui instance
    ui_core_content += """
Object.assign(ui, dashboardView, customersView, productsView, ordersView, cropsView, tasksView, settingsView);
window.ui = ui; // Expose to global for HTML inline handlers (temporário)
"""
else:
    ui_core_content += remaining_content

# Save ui-core.js
with open('js/ui-core.js', 'w', encoding='utf-8') as f:
    f.write(ui_core_content)

print("Split completed successfully.")
