#!/bin/bash

mkdir transparent

# Loop over all .jpg in the original folder
idx=0
for originalfilename in original/*.{jpg,png}; do
    # Determine the file name (without path and extension)
    filename=$(basename -- "$originalfilename")
    extension="${filename##*.}"
    filename="${filename%.*}"
    
    # Determine top left pixel color and set transparency
    # https://stackoverflow.com/a/44542839
    color=$( convert $originalfilename -format "%[pixel:p{0,0}]" info:- )
    convert $originalfilename -alpha off -bordercolor $color -border 1 \
    \( +clone -fuzz 5% -fill none -floodfill +0+0 $color \
    -alpha extract -geometry 200% -blur 0x0.5 \
    -morphology erode square:1 -geometry 50% \) \
    -compose CopyOpacity -composite -shave 1 -trim transparent/$idx.png
    
    
    # resize to 500 px width, keeping aspect ratio
    convert -geometry -500x transparent/$idx.png transparent/$idx.png
    # Pad with transparency to 500x500
    convert transparent/$idx.png -resize 500x500 -background transparent -gravity center -extent 500x500 transparent/$idx.png
    
    echo "$originalfilename -> transparent/$idx.png"
    ((idx++))
done