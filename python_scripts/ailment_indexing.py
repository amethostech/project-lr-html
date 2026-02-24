import pandas as pd

# File paths
input_file = "input.csv"
keyword_file = "ailment_index.csv"
output_file = "ai_output.csv"

# Read CSV files
df_input = pd.read_csv(input_file)
df_keywords = pd.read_csv(keyword_file)

# Ensure text columns are strings
df_input["Disease"] = df_input["Disease"].astype(str)
df_keywords["Keyword"] = df_keywords["Keyword"].astype(str)

# Create dictionary: keyword -> index
keyword_to_index = dict(zip(df_keywords["Keyword"], df_keywords["Index"]))

def find_index(condition_text):
    matches = []
    for keyword, index in keyword_to_index.items():
        if keyword.lower() in condition_text.lower():
            matches.append(str(index))
    return ",".join(matches) if matches else ""

# Apply matching
df_input["aindex"] = df_input["Disease"].apply(find_index)

# Save output
df_input.to_csv(output_file, index=False)

print("Output saved to", output_file)
