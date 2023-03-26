import { ImageList, ImageListItem } from "@mui/material";
import React from "react";

function ImagesContainer({images, category} : {images: string[], category: string}) {
    return (
        <ImageList variant="masonry" cols={10}>
            {images.map((item) => (
                <ImageListItem key={item}>
                <img
                    src={`${item}?w=50&fit=crop&auto=format`}
                    srcSet={`${item}?w=50&fit=crop&auto=format&dpr=2 2x`}
                    alt={category}
                    loading="lazy"
                />
                </ImageListItem>
            ))}
        </ImageList>
    )
}

export default ImagesContainer;