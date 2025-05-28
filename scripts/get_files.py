import os

def get_js_file_list():
    files = []
    for entry in os.listdir('.'):
        if os.path.isfile(entry):
            name, _ = os.path.splitext(entry)
            files.append(f'"{name}"')

    js_list = "[\n  " + ",\n  ".join(files) + "\n]"
    print(js_list)

if __name__ == "__main__":
    get_js_file_list()
