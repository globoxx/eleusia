import { ImageList, ImageListItem } from "@mui/material";
import React from "react";

function ImagesContainer({images, category} : {images: string[], category: string}) {
    return (
        <ImageList sx={{ width: 500, height: 450 }} cols={3} rowHeight={164}>
            {images.map((item) => (
                <ImageListItem key={item}>
                <img
                    src={`${item}?w=164&h=164&fit=crop&auto=format`}
                    srcSet={`${item}?w=164&h=164&fit=crop&auto=format&dpr=2 2x`}
                    alt={category}
                    loading="lazy"
                />
                </ImageListItem>
            ))}
        </ImageList>
    )
}

export default ImagesContainer;